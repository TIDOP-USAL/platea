const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const db      = require('../db');

// El geojson ya no se escribe a disco: se parsea y se guarda en `contenido_capas`.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(geojson|json)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    cb(new Error('Solo se permiten archivos .geojson o .json'));
  }
});

function parseGeoJSON(buffer) {
  let data;
  try {
    data = JSON.parse(buffer.toString('utf8'));
  } catch (e) {
    throw new Error('El archivo GeoJSON no es un JSON válido');
  }
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) return data.features;
  if (data.type === 'Feature') return [data];
  throw new Error('El GeoJSON debe ser un FeatureCollection o un Feature');
}

const DECIMALES_COORDENADAS = 6; // ~11 cm de precisión — de sobra para este uso

function redondearCoordenadas(coords) {
  if (typeof coords[0] === 'number') {
    return coords.map(n => Number(n.toFixed(DECIMALES_COORDENADAS)));
  }
  return coords.map(c => redondearCoordenadas(c));
}

function redondearGeometria(geometry) {
  if (!geometry) return geometry;
  if (Array.isArray(geometry.coordinates)) {
    return { ...geometry, coordinates: redondearCoordenadas(geometry.coordinates) };
  }
  if (Array.isArray(geometry.geometries)) {
    return { ...geometry, geometries: geometry.geometries.map(redondearGeometria) };
  }
  return geometry;
}

async function reemplazarContenidoCapa(idCapa, features) {
  const client = await db.connect();
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

router.get('/', async (req, res) => {
  const { seccion } = req.query;
  try {
    let query = `
      SELECT g.id, g.nombre, g.orden, s.nombre AS seccion
      FROM grupo g
      JOIN seccion s ON g.id_seccion = s.id
    `;
    const params = [];
    if (seccion) {
      query += ' WHERE s.nombre = $1';
      params.push(seccion);
    }
    query += ' ORDER BY g.orden';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo capas' });
  }
});
 
// GET /api/capas/grupo/:idGrupo
router.get('/grupo/:idGrupo', async (req, res) => {
  const { idGrupo } = req.params;
  try {
    const { rows: capas } = await db.query(
      'SELECT * FROM capa WHERE id_grupo = $1 ORDER BY orden',
      [idGrupo]
    );
    res.json(capas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo capas' });
  }
});

// GET /api/capas/seccion/:seccion
router.get('/seccion/:seccion', async (req, res) => {
  const { seccion } = req.params;
  try {
    const { rows: grupos } = await db.query(`
      SELECT g.id, g.nombre, g.orden
      FROM grupo g
      JOIN seccion s ON g.id_seccion = s.id
      WHERE s.nombre = $1
      ORDER BY g.orden
    `, [seccion]);

    const resultado = await Promise.all(grupos.map(async (grupo) => {
      const { rows: capas } = await db.query(
        'SELECT * FROM capa WHERE id_grupo = $1 ORDER BY orden',
        [grupo.id]
      );
      return { ...grupo, capas };
    }));

    res.json(resultado);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo capas' });
  }
});

// GET /api/capas/seccion/:seccion/activas
router.get('/seccion/:seccion/activas', async (req, res) => {
  const { seccion } = req.params;
  try {
    const { rows } = await db.query(`
      SELECT c.* FROM capa c
      JOIN grupo g ON c.id_grupo = g.id
      JOIN seccion s ON g.id_seccion = s.id
      WHERE s.nombre = $1 AND c.checked = true
      ORDER BY c.orden
    `, [seccion]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo capas activas' });
  }
});

// POST /api/capas/seccion/:seccion/reset
router.post('/seccion/:seccion/reset', async (req, res) => {
  const { seccion } = req.params;
  try {
    await db.query(`
      UPDATE capa SET checked = false
      WHERE id_grupo IN (
        SELECT g.id FROM grupo g
        JOIN seccion s ON g.id_seccion = s.id
        WHERE s.nombre = $1
      )
    `, [seccion]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error reseteando capas' });
  }
});

// GET /api/capas/catalogo — listado completo (todas las secciones) con nº de
// features y tamaño aproximado por capa, para el selector de descarga del móvil.
router.get('/catalogo', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        s.id   AS seccion_id, s.nombre AS seccion_nombre,
        g.id   AS grupo_id,   g.nombre AS grupo_nombre, g.orden AS grupo_orden,
        c.id   AS capa_id,    c.texto, c.tipo, c.nombre_source, c.color, c.grosor,
        c.capa_wms, c.url, c.imagen, c.checked, c.orden AS capa_orden,
        COUNT(cc.id) FILTER (WHERE cc.deleted = false)::int AS n_features,
        COALESCE(SUM(length(cc.geometry) + length(coalesce(cc.properties, '')))
          FILTER (WHERE cc.deleted = false), 0)::bigint AS tamano_bytes,
        MAX(cc.updated_at) AS ultima_actualizacion  -- incluye borrados: un borrado también es un cambio
      FROM seccion s
      JOIN grupo g ON g.id_seccion = s.id
      JOIN capa  c ON c.id_grupo   = g.id
      LEFT JOIN contenido_capas cc ON cc.capa_id = c.id
      GROUP BY s.id, s.nombre, g.id, g.nombre, g.orden, c.id
      ORDER BY s.id, g.orden, c.orden;
    `);

    // Anidar en secciones -> grupos -> capas
    const secciones = new Map();
    for (const fila of rows) {
      if (!secciones.has(fila.seccion_id)) {
        secciones.set(fila.seccion_id, { id: fila.seccion_id, nombre: fila.seccion_nombre, grupos: new Map() });
      }
      const seccion = secciones.get(fila.seccion_id);
      if (!seccion.grupos.has(fila.grupo_id)) {
        seccion.grupos.set(fila.grupo_id, { id: fila.grupo_id, nombre: fila.grupo_nombre, orden: fila.grupo_orden, capas: [] });
      }
      seccion.grupos.get(fila.grupo_id).capas.push({
        id: fila.capa_id,
        texto: fila.texto,
        tipo: fila.tipo,
        nombre_source: fila.nombre_source,
        color: fila.color,
        grosor: fila.grosor,
        capa_wms: fila.capa_wms,
        url: fila.url,
        imagen: fila.imagen,
        checked: fila.checked,
        orden: fila.capa_orden,
        n_features: fila.n_features,
        tamano_bytes: fila.tamano_bytes,
        ultima_actualizacion: fila.ultima_actualizacion,
      });
    }

    const resultado = Array.from(secciones.values()).map(s => ({
      ...s,
      grupos: Array.from(s.grupos.values()),
    }));

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo el catálogo de capas' });
  }
});

// GET /api/capas/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM capa WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Capa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo capa' });
  }
});

// GET /api/capas/:id/geojson
// Por defecto: FeatureCollection normal (usado por el mapa web).
// ?formato=filas: filas de contenido_capas con su id (usado por el móvil,
//   tanto para la descarga inicial de una capa como para actualizarla).
// ?since=<ISO>: combinado con formato=filas, delta desde esa fecha en vez
//   de todo el contenido (incluye deleted, para saber qué borrar local).
router.get('/:id/geojson', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    if (req.query.since && isNaN(since.getTime())) {
      return res.status(400).json({ error: 'Parámetro since inválido (usa formato ISO 8601)' });
    }
    const formatoFilas = req.query.formato === 'filas';

    const { rows: [{ ahora }] } = await db.query('SELECT now() AS ahora');

    if (formatoFilas) {
      // Paginación por id (keyset): ?limit=2000&after_id=<último id recibido>
      const limit   = Math.min(Number(req.query.limit) || 0, 10000); // 0 = sin límite
      const afterId = Number(req.query.after_id) || 0;
      const params  = [req.params.id, afterId];
      let sql = since
        ? 'SELECT id, geometry, properties, updated_at, deleted FROM contenido_capas WHERE capa_id = $1 AND id > $2 AND updated_at > $3'
        : 'SELECT id, geometry, properties, updated_at, deleted FROM contenido_capas WHERE capa_id = $1 AND id > $2 AND deleted = false';
      if (since) params.push(since);
      sql += ' ORDER BY id';
      if (limit) { params.push(limit); sql += ` LIMIT $${params.length}`; }

      const { rows } = await db.query(sql, params);
      return res.json({
        capa_id: Number(req.params.id),
        generado_en: ahora,
        incremental: !!since,
        siguiente_id: limit && rows.length === limit ? rows[rows.length - 1].id : null,
        contenido: rows,
      });
    }

    const { rows } = await db.query(
      'SELECT geometry, properties FROM contenido_capas WHERE capa_id = $1 AND deleted = false',
      [req.params.id]
    );
    res.json({
      type: 'FeatureCollection',
      generado_en: ahora,
      features: rows.map(r => ({
        type: 'Feature',
        geometry: JSON.parse(r.geometry),
        properties: r.properties ? JSON.parse(r.properties) : {},
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo geojson de la capa' });
  }
});

// PATCH /api/capas/:id/toggle
router.patch('/:id/toggle', async (req, res) => {
  const { checked } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE capa SET checked = $1 WHERE id = $2 RETURNING *',
      [checked, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Capa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando capa' });
  }
});

// PATCH /api/capas/:id/orden
router.patch('/:id/orden', async (req, res) => {
  const { orden } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE capa SET orden = $1 WHERE id = $2 RETURNING *',
      [orden, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Capa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando orden' });
  }
});

// POST /api/capas/:id/geojson — guarda el contenido en contenido_capas (ya no sube archivo)
router.post('/:id/geojson', upload.single('archivo'), async (req, res) => {
  try {
    const { rows: capas } = await db.query('SELECT * FROM capa WHERE id = $1', [req.params.id]);
    if (!capas.length) return res.status(404).json({ error: 'Capa no encontrada' });

    let features;
    try {
      features = parseGeoJSON(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    await reemplazarContenidoCapa(req.params.id, features);

    const { rows: capaActualizada } = await db.query(
      'UPDATE capa SET actualizado_en = now() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json({ ok: true, capa: capaActualizada[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando GeoJSON' });
  }
});

module.exports = router;