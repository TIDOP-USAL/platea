// src/routes/admin-capas.js

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── Multer — subida de archivos ─────────────────────────────────────────────
// Todo va a memoria: el geojson se parsea e inserta en la tabla `contenido_capas`
// (nunca se escribe a disco); la imagen, si llega, se escribe a disco manualmente
// desde el buffer para mantener el comportamiento anterior.
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads/capas';

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'archivo_json') {
      // El contenido ahora va a la tabla, así que solo aceptamos JSON/GeoJSON.
      // Si necesitas soportar .zip (shapefile), avísame y lo añadimos aparte.
      if (['.json', '.geojson'].includes(ext)) return cb(null, true);
      return cb(new Error(`Para archivo_json solo se admite .json o .geojson (recibido: ${ext})`));
    }
    if (file.fieldname === 'archivo_imagen') {
      const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
      if (allowed.includes(ext)) return cb(null, true);
      return cb(new Error(`Tipo de imagen no permitido: ${ext}`));
    }
    cb(new Error(`Campo de archivo no esperado: ${file.fieldname}`));
  },
});

// Helper para borrar archivo antiguo si existe (solo se usa ya para imágenes)
function borrarArchivo(nombre) {
  if (!nombre) return;
  const fichero = path.basename(nombre);
  const ruta = path.join(UPLOADS_DIR, fichero);
  fs.unlink(ruta, (err) => {});
}

// Escribe el buffer de una imagen en disco con un nombre "seguro" y devuelve el filename
function guardarImagenEnDisco(file) {
  const ext  = path.extname(file.originalname);
  const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
  const filename = `${base}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer);
  return filename;
}

// Parsea el buffer subido como GeoJSON y valida que sea un FeatureCollection
function parseGeoJSON(buffer) {
  let data;
  try {
    data = JSON.parse(buffer.toString('utf8'));
  } catch (e) {
    throw new Error('El archivo GeoJSON no es un JSON válido');
  }
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data.features;
  }
  if (data.type === 'Feature') {
    return [data];
  }
  throw new Error('El GeoJSON debe ser un FeatureCollection o un Feature');
}

const DECIMALES_COORDENADAS = 6; // ~11 cm de precisión — de sobra para este uso

function redondearCoordenadas(coords) {
  if (typeof coords[0] === 'number') {
    return coords.map(n => Number(n.toFixed(DECIMALES_COORDENADAS)));
  }
  return coords.map(c => redondearCoordenadas(c));
}

// Reduce el tamaño del geojson redondeando la precisión de las coordenadas.
// Muchos exports de shapefile sacan 14-15 decimales (precisión de nanómetros,
// inútil aquí) y eso infla mucho el tamaño guardado en contenido_capas.
function redondearGeometria(geometry) {
  if (!geometry) return geometry;
  if (Array.isArray(geometry.coordinates)) {
    return { ...geometry, coordinates: redondearCoordenadas(geometry.coordinates) };
  }
  if (Array.isArray(geometry.geometries)) {
    // GeometryCollection
    return { ...geometry, geometries: geometry.geometries.map(redondearGeometria) };
  }
  return geometry;
}

// Reemplaza el contenido de una capa en `contenido_capas`:
// borra lógicamente lo anterior e inserta las features nuevas, en una transacción.
async function reemplazarContenidoCapa(idCapa, features) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE contenido_capas SET deleted = true WHERE capa_id = $1 AND deleted = false',
      [idCapa]
    );
    for (const feature of features) {
      await client.query(
        `INSERT INTO contenido_capas (capa_id, geometry, properties)
         VALUES ($1, $2, $3)`,
        [
          idCapa,
          JSON.stringify(redondearGeometria(feature.geometry)),
          feature.properties ? JSON.stringify(feature.properties) : null,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── SECCIONES ────────────────────────────────────────────────────────────────

router.get('/secciones', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM seccion ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/secciones', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  try {
    const { rows } = await pool.query('INSERT INTO seccion (nombre) VALUES ($1) RETURNING *', [nombre]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una sección con ese nombre' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/secciones/:id', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  try {
    const { rows } = await pool.query('UPDATE seccion SET nombre = $1 WHERE id = $2 RETURNING *', [nombre, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una sección con ese nombre' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/secciones/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM seccion WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GRUPOS ───────────────────────────────────────────────────────────────────

router.get('/grupos', async (req, res) => {
  const { id_seccion } = req.query;
  try {
    const { rows } = id_seccion
      ? await pool.query('SELECT * FROM grupo WHERE id_seccion = $1 ORDER BY orden, id', [id_seccion])
      : await pool.query('SELECT * FROM grupo ORDER BY id_seccion, orden, id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/grupos', async (req, res) => {
  const { nombre, id_seccion, orden } = req.body;
  if (!nombre)     return res.status(400).json({ error: 'nombre es obligatorio' });
  if (!id_seccion) return res.status(400).json({ error: 'id_seccion es obligatorio' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO grupo (nombre, id_seccion, orden) VALUES ($1, $2, $3) RETURNING *',
      [nombre, id_seccion, orden ?? 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/grupos/:id', async (req, res) => {
  const { nombre, orden } = req.body;
  try {
    const updates = [], values = [];
    let idx = 1;
    if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); values.push(nombre); }
    if (orden  !== undefined) { updates.push(`orden  = $${idx++}`); values.push(orden); }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE grupo SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/grupos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM grupo WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CAPAS ────────────────────────────────────────────────────────────────────

router.get('/capas', async (req, res) => {
  const { id_grupo } = req.query;
  try {
    const { rows } = id_grupo
      ? await pool.query('SELECT * FROM capa WHERE id_grupo = $1 ORDER BY orden, id', [id_grupo])
      : await pool.query('SELECT * FROM capa ORDER BY id_grupo, orden, id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /capas — acepta multipart (con archivos) o JSON (sin archivos)
router.post('/capas', upload.fields([
  { name: 'archivo_json',   maxCount: 1 },
  { name: 'archivo_imagen', maxCount: 1 },
]), async (req, res) => {

  const b = req.body;
  if (!b.texto)    return res.status(400).json({ error: 'texto es obligatorio' });
  if (!b.id_grupo) return res.status(400).json({ error: 'id_grupo es obligatorio' });
  const BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://platea.tidop.es'
    : 'http://localhost:3000';

  const archivoJsonFile = req.files?.archivo_json?.[0] || null;
  const archivoImagenFile = req.files?.archivo_imagen?.[0] || null;

  // Validar el geojson ANTES de tocar la BD, para no dejar la capa a medias
  let features = null;
  if (archivoJsonFile) {
    try {
      features = parseGeoJSON(archivoJsonFile.buffer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  const imagen = archivoImagenFile ? guardarImagenEnDisco(archivoImagenFile) : null;
  const imagen_url = imagen ? `${BASE_URL}/uploads/capas/${imagen}` : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO capa
        (id_grupo, tipo, texto, imagen, nombre_source, url, capa_wms, color, grosor, checked, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        Number(b.id_grupo),
        b.tipo        || null,
        b.texto,
        imagen_url,
        b.nombre_source || null,
        b.url         || null,
        b.capa_wms    || null,
        b.color       || null,
        b.grosor      ? Number(b.grosor) : null,
        b.checked === 'true' || b.checked === true,
        Number(b.orden) || 0,
      ]
    );
    const capa = rows[0];

    if (features) {
      await reemplazarContenidoCapa(capa.id, features);
    }

    res.status(201).json(capa);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /capas/:id — acepta multipart o JSON
router.patch('/capas/:id', upload.fields([
  { name: 'archivo_json',   maxCount: 1 },
  { name: 'archivo_imagen', maxCount: 1 },
]), async (req, res) => {
  const b = req.body;
  const campos = ['tipo','texto','nombre_source','url','capa_wms','color','grosor','checked','orden'];

  const archivoJsonFile = req.files?.archivo_json?.[0] || null;
  const archivoImagenFile = req.files?.archivo_imagen?.[0] || null;

  // Validar el geojson ANTES de tocar la BD
  let features = null;
  if (archivoJsonFile) {
    try {
      features = parseGeoJSON(archivoJsonFile.buffer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  try {
    let extraUpdates = [];
    let extraValues  = [];
    const BASE_URL = process.env.NODE_ENV === 'production'
      ? 'https://platea.tidop.es'
      : 'http://localhost:3000';

    if (archivoImagenFile) {
      const { rows: old } = await pool.query('SELECT imagen FROM capa WHERE id = $1', [req.params.id]);
      borrarArchivo(old[0]?.imagen);
      const imagen = guardarImagenEnDisco(archivoImagenFile);
      extraUpdates.push('imagen');
      extraValues.push(`${BASE_URL}/uploads/capas/${imagen}`);
    }

    const updates = [], values = [];
    let idx = 1;

    for (const campo of campos) {
      if (b[campo] !== undefined) {
        updates.push(`${campo} = $${idx++}`);
        values.push(campo === 'grosor' ? (b[campo] !== undefined && b[campo] !== '' ? Number(b[campo]) : null)
                  : campo === 'checked' ? (b[campo] === 'true' || b[campo] === true)
                  : campo === 'orden'   ? Number(b[campo])
                  : b[campo] || null);
      }
    }

    for (let i = 0; i < extraUpdates.length; i++) {
      updates.push(`${extraUpdates[i]} = $${idx++}`);
      values.push(extraValues[i]);
    }

    let capaActualizada;
    if (updates.length) {
      values.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE capa SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
      capaActualizada = rows[0];
    } else {
      const { rows } = await pool.query('SELECT * FROM capa WHERE id = $1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
      capaActualizada = rows[0];
    }

    if (features) {
      await reemplazarContenidoCapa(req.params.id, features);
    }

    res.json(capaActualizada);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/capas/:id', async (req, res) => {
  try {
    // Borrar archivo de imagen asociado antes de eliminar el registro.
    // El contenido en `contenido_capas` se borra solo vía ON DELETE CASCADE.
    const { rows } = await pool.query('SELECT imagen FROM capa WHERE id = $1', [req.params.id]);
    if (rows[0]) {
      borrarArchivo(rows[0].imagen);
    }
    await pool.query('DELETE FROM capa WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;