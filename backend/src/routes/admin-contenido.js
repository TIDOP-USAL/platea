// src/routes/admin-contenido.js
// Edición del contenido (filas de `contenido_capas`) de las capas NO WMS.
// Se monta en /admin/api/contenido (ver index.js).

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Capa "no WMS": sin capa_wms y con tipo distinto de wms/wmts
const NO_WMS = `(c.capa_wms IS NULL OR c.capa_wms = '')
                AND COALESCE(c.tipo, '') NOT IN ('wms', 'wmts')`;

// ─── Subida de fotos (campo path_photo de hidrantes) ────────────────────────
// Se guardan en <UPLOADS_DIR>/PLATEA-GIS/foto_hidrantes, servido en /uploads/capas/PLATEA-GIS/foto_hidrantes/...
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads/capas';
// Mismo formato de ruta que ya usan los hidrantes: "PLATEA-GIS/foto_hidrantes/010_001.jpeg"
const PREFIJO_FOTOS = 'PLATEA-GIS/foto_hidrantes/';
const FOTOS_DIR   = path.join(UPLOADS_DIR, 'PLATEA-GIS', 'foto_hidrantes');
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return cb(null, true);
    cb(new Error(`Tipo de imagen no permitido: ${ext || '(sin extensión)'}`));
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DECIMALES_COORDENADAS = 6;

function redondearCoordenadas(coords) {
  if (typeof coords[0] === 'number') return coords.map(n => Number(n.toFixed(DECIMALES_COORDENADAS)));
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

function esObjeto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validarGeometria(g) {
  if (!esObjeto(g) || typeof g.type !== 'string') {
    throw new Error('La geometría debe ser un objeto GeoJSON con "type"');
  }
  if (g.type === 'GeometryCollection') {
    if (!Array.isArray(g.geometries)) throw new Error('GeometryCollection requiere "geometries"');
  } else if (!Array.isArray(g.coordinates)) {
    throw new Error('La geometría requiere "coordinates"');
  }
}

function parseJSONSeguro(texto) {
  if (texto === null || texto === undefined) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

function filaAFeature(r) {
  return {
    id: r.id,
    capa_id: r.capa_id,
    geometry: parseJSONSeguro(r.geometry),
    properties: parseJSONSeguro(r.properties) || {},
    updated_at: r.updated_at,
  };
}

// ─── GET /capas — listado de capas no WMS ────────────────────────────────────
router.get('/capas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.texto, c.tipo, c.id_grupo,
             g.nombre AS grupo, s.nombre AS seccion,
             COUNT(cc.id) FILTER (WHERE cc.deleted = false)::int AS n_features,
             MAX(cc.updated_at) AS ultima_actualizacion
      FROM capa c
      JOIN grupo   g ON g.id = c.id_grupo
      JOIN seccion s ON s.id = g.id_seccion
      LEFT JOIN contenido_capas cc ON cc.capa_id = c.id
      WHERE ${NO_WMS}
      GROUP BY c.id, g.id, s.id
      ORDER BY s.id, g.orden, c.orden, c.id
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /capas/:id/features — listado paginado (sin geometría completa) ─────
// ?page=1&limit=50&q=texto  (q busca dentro de las propiedades)
router.get('/capas/:id/features', async (req, res) => {
  try {
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const q     = (req.query.q || '').trim();

    const params = [req.params.id];
    let where = 'cc.capa_id = $1 AND cc.deleted = false';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND cc.properties ILIKE $${params.length}`;
    }

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM contenido_capas cc WHERE ${where}`, params
    );

    params.push(limit, (page - 1) * limit);
    const { rows } = await pool.query(
      `SELECT cc.id, cc.properties, cc.updated_at,
              substring(cc.geometry from '"type"\\s*:\\s*"([A-Za-z]+)"') AS tipo_geometria
       FROM contenido_capas cc
       WHERE ${where}
       ORDER BY cc.id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      total, page, limit,
      features: rows.map(r => ({
        id: r.id,
        tipo_geometria: r.tipo_geometria,
        properties: parseJSONSeguro(r.properties) || {},
        updated_at: r.updated_at,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /features/:id — una feature completa (con geometría) ────────────────
router.get('/features/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, capa_id, geometry, properties, updated_at
       FROM contenido_capas WHERE id = $1 AND deleted = false`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(filaAFeature(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /capas/:id/features — añadir una feature ───────────────────────────
router.post('/capas/:id/features', async (req, res) => {
  try {
    const { geometry, properties } = req.body;
    validarGeometria(geometry);
    if (properties !== undefined && properties !== null && !esObjeto(properties)) {
      return res.status(400).json({ error: 'properties debe ser un objeto' });
    }

    const { rows: capa } = await pool.query(
      `SELECT c.id FROM capa c WHERE c.id = $1 AND ${NO_WMS}`, [req.params.id]
    );
    if (!capa[0]) return res.status(404).json({ error: 'Capa no encontrada o es WMS' });

    const { rows } = await pool.query(
      `INSERT INTO contenido_capas (capa_id, geometry, properties)
       VALUES ($1, $2, $3)
       RETURNING id, capa_id, geometry, properties, updated_at`,
      [
        req.params.id,
        JSON.stringify(redondearGeometria(geometry)),
        properties ? JSON.stringify(properties) : null,
      ]
    );
    res.status(201).json(filaAFeature(rows[0]));
  } catch (err) {
    const status = /geometr|GeometryCollection|coordinates/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── PATCH /features/:id — modificar propiedades y/o geometría ───────────────
// updated_at se actualiza explícitamente: el export incremental y la sincronización
// del móvil se basan en él.
router.patch('/features/:id', async (req, res) => {
  try {
    const { geometry, properties } = req.body;
    const sets = [], values = [];

    if (properties !== undefined) {
      if (properties !== null && !esObjeto(properties)) {
        return res.status(400).json({ error: 'properties debe ser un objeto' });
      }
      values.push(properties ? JSON.stringify(properties) : null);
      sets.push(`properties = $${values.length}`);
    }
    if (geometry !== undefined) {
      validarGeometria(geometry);
      values.push(JSON.stringify(redondearGeometria(geometry)));
      sets.push(`geometry = $${values.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE contenido_capas SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${values.length} AND deleted = false
       RETURNING id, capa_id, geometry, properties, updated_at`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });

    res.json(filaAFeature(rows[0]));
  } catch (err) {
    const status = /geometr|GeometryCollection|coordinates/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── DELETE /features/:id — borrado lógico (el móvil lo recibe como deleted) ─
router.delete('/features/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE contenido_capas SET deleted = true, updated_at = now()
       WHERE id = $1 AND deleted = false RETURNING capa_id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /fotos — sube una foto y devuelve la ruta para guardar en path_photo ─
// multipart/form-data, campo "foto". No modifica ninguna feature: el panel pone
// la ruta devuelta en el campo path_photo y se guarda con el PATCH/POST normal.
router.post('/fotos', (req, res) => {
  uploadFoto.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo (campo "foto")' });

    const ext  = path.extname(req.file.originalname).toLowerCase();
    const base = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'foto';
    const filename = `${Date.now()}_${base}${ext}`;   // evita sobrescribir fotos existentes

    try {
      fs.writeFileSync(path.join(FOTOS_DIR, filename), req.file.buffer);
    } catch (e) {
      return res.status(500).json({ error: 'No se pudo guardar la foto: ' + e.message });
    }

    res.status(201).json({ filename, path: PREFIJO_FOTOS + filename });
  });
});

// ─── DELETE /fotos — borra una foto subida y aún sin usar (al cancelar el modal) ─
// Solo borra ficheros de la carpeta de fotos que NO estén referenciados por ningún
// elemento, así que no puede eliminar fotos en uso.
router.delete('/fotos', async (req, res) => {
  try {
    const rel = req.body && req.body.path;
    if (typeof rel !== 'string' || !rel.startsWith(PREFIJO_FOTOS)) {
      return res.status(400).json({ error: 'Ruta no válida' });
    }
    const abs = path.resolve(UPLOADS_DIR, rel);
    if (!abs.startsWith(FOTOS_DIR + path.sep)) {
      return res.status(400).json({ error: 'Ruta no válida' });
    }
    const { rows } = await pool.query(
      'SELECT 1 FROM contenido_capas WHERE strpos(properties, $1) > 0 LIMIT 1', [rel]
    );
    if (rows[0]) return res.status(409).json({ error: 'La foto está en uso' });

    fs.unlink(abs, () => {});
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;