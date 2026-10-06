// ─────────────────────────────────────────────────────────────────────────────
// src/routes/export.js
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const AdmZip  = require('adm-zip');
const pool    = require('../db');

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads/capas';

/**
 * Extrae el basename de cualquier ruta que apunte a /uploads/capas/
 * (se sigue usando para la imagen, que sigue siendo un archivo real).
 */
function extraerNombreUpload(ruta) {
  if (!ruta) return null;
  const match = ruta.match(/\/uploads\/capas\/([^/?#]+)$/);
  return match ? match[1] : null;
}

// GET /api/export/last — info del último paquete generado, para que el panel
// admin sepa desde cuándo sería un export incremental.
router.get('/last', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT exportado_en, tipo, filas_contenido, creado_en FROM export_log ORDER BY exportado_en DESC LIMIT 1'
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('[export] Error obteniendo último export:', err);
    res.status(500).json({ error: 'Error obteniendo el último export' });
  }
});

// GET /api/export/android?modo=completo|incremental (por defecto: completo)
//
// modo=completo: todo el contenido activo (deleted=false).
// modo=incremental: solo lo cambiado desde el último export registrado en
//   export_log (incluye lo borrado, para que el móvil también lo borre).
//   Si no hay ningún export previo, se hace un completo igualmente.
//
// El .geojson por capa ya no se reconstruye como archivo: se exportan las
// filas de contenido_capas tal cual, para importarlas directamente en la
// tabla equivalente de SQLite del móvil (mismo esquema: id, capa_id,
// geometry, properties, updated_at, deleted).
router.get('/android', async (req, res) => {
  try {
    const modoSolicitado = req.query.modo === 'incremental' ? 'incremental' : 'completo';

    let since = null;
    if (modoSolicitado === 'incremental') {
      const { rows } = await pool.query(
        'SELECT exportado_en FROM export_log ORDER BY exportado_en DESC LIMIT 1'
      );
      since = rows[0]?.exportado_en || null; // sin export previo -> cae a completo
    }
    const modo = since ? 'incremental' : 'completo';

    // Timestamp del servidor ANTES de leer nada: es el que se guarda en
    // export_log como próximo "since", para no perder cambios que ocurran
    // mientras se genera este export.
    const { rows: [{ ahora }] } = await pool.query('SELECT now() AS ahora');

    const [seccionesRes, gruposRes, capasRes, contenidoRes] = await Promise.all([
      pool.query('SELECT * FROM seccion ORDER BY id'),
      pool.query('SELECT * FROM grupo   ORDER BY id_seccion, orden'),
      pool.query('SELECT * FROM capa    ORDER BY id_grupo, orden'),
      since
        ? pool.query(
            'SELECT id, capa_id, geometry, properties, updated_at, deleted FROM contenido_capas WHERE updated_at > $1 ORDER BY id',
            [since]
          )
        : pool.query(
            'SELECT id, capa_id, geometry, properties, updated_at, deleted FROM contenido_capas WHERE deleted = false ORDER BY id'
          ),
    ]);

    const data = {
      generado_en: ahora,
      incremental: modo === 'incremental',
      desde: since ? since.toISOString() : null,
      secciones: seccionesRes.rows,
      grupos:    gruposRes.rows,
      capas:     capasRes.rows,
      contenido_capas: contenidoRes.rows,
    };

    const zip = new AdmZip();
    zip.addFile('data.json', Buffer.from(JSON.stringify(data, null, 2), 'utf8'));

    // La imagen sigue siendo un archivo real en disco: se empaqueta igual que antes.
    // (Nota: las imágenes se exportan siempre completas; no hay aún seguimiento
    // incremental para ellas — se podría añadir con un updated_at en `capa`.)
    let incluidos = 0;
    const noEncontrados = [];
    for (const capa of capasRes.rows) {
      const nombreImagen = extraerNombreUpload(capa.imagen);
      if (!nombreImagen) continue;
      if (zip.getEntry(`uploads/${nombreImagen}`)) continue;

      const rutaAbsoluta = path.join(UPLOADS_DIR, nombreImagen);
      if (fs.existsSync(rutaAbsoluta)) {
        zip.addLocalFile(rutaAbsoluta, 'uploads');
        incluidos++;
      } else {
        noEncontrados.push(nombreImagen);
      }
    }

    // Fotos de elementos (path_photo) subidas desde el panel: se empaquetan en
    // uploads/<path_photo> para que la app las tenga offline. Las fotos antiguas
    // (que no están en el servidor) simplemente se ignoran.
    const PREFIJO_FOTOS = 'PLATEA-GIS/foto_hidrantes/';
    const DIR_FOTOS = path.resolve(UPLOADS_DIR, PREFIJO_FOTOS);
    let fotosIncluidas = 0;
    for (const fila of data.contenido_capas) {
      if (fila.deleted || !fila.properties) continue;
      let pp;
      try {
        const props = typeof fila.properties === 'string' ? JSON.parse(fila.properties) : fila.properties;
        pp = props && props.path_photo;
      } catch { continue; }
      if (typeof pp !== 'string' || !pp.startsWith(PREFIJO_FOTOS)) continue;

      const abs = path.resolve(UPLOADS_DIR, pp);
      if (!abs.startsWith(DIR_FOTOS + path.sep)) continue;      // evita rutas con ..
      const entrada = `uploads/${pp}`;
      if (zip.getEntry(entrada) || !fs.existsSync(abs)) continue;
      zip.addLocalFile(abs, path.posix.dirname(entrada));
      fotosIncluidas++;
    }

    if (noEncontrados.length > 0) {
      console.warn('[export] Archivos no encontrados en disco:', noEncontrados);
    }
    console.log(
      `[export] ZIP generado (${modo}${since ? ' desde ' + since.toISOString() : ''}): ` +
      `${data.contenido_capas.length} filas de contenido, ${incluidos} imágenes y ${fotosIncluidas} fotos incluidas.`
    );

    // Registrar el export SOLO si todo lo anterior fue bien (antes de mandar la respuesta,
    // para no contar como "hecho" un export que falle al enviarse).
    await pool.query(
      'INSERT INTO export_log (exportado_en, tipo, filas_contenido) VALUES ($1, $2, $3)',
      [ahora, modo, data.contenido_capas.length]
    );

    const fecha     = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const nombreZip = `plateagis-android-${fecha}.zip`;
    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreZip}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);

  } catch (err) {
    console.error('[export] Error inesperado:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno al generar el paquete' });
    }
  }
});

module.exports = router;