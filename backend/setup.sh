#!/bin/sh
# Ejecutar desde la carpeta backend/
# sh setup.sh

mkdir -p src/routes uploads/capas

# ── package.json ───────────────────────────────
cat > package.json << 'EOF'
{
  "name": "plateagis-backend",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.12.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}
EOF

# ── Dockerfile ─────────────────────────────────
cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/index.js"]
EOF

# ── src/db.js ──────────────────────────────────
cat > src/db.js << 'EOF'
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'plateagis',
  user:     process.env.DB_USER || 'plateagis',
  password: process.env.DB_PASS || 'plateagis_pass',
});

module.exports = pool;
EOF

# ── src/index.js ───────────────────────────────
cat > src/index.js << 'EOF'
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const capasRouter  = require('./routes/capas');
const gruposRouter = require('./routes/grupos');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/uploads/capas', express.static(
  path.join(__dirname, '..', 'uploads', 'capas')
));

app.use('/api/capas',  capasRouter);
app.use('/api/grupos', gruposRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`PlateaGIS API corriendo en puerto ${PORT}`);
});
EOF

# ── src/routes/grupos.js ───────────────────────
cat > src/routes/grupos.js << 'EOF'
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/grupos?seccion=diputacion
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
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
});

// GET /api/grupos/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM grupo WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Grupo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo grupo' });
  }
});

module.exports = router;
EOF

# ── src/routes/capas.js ────────────────────────
cat > src/routes/capas.js << 'EOF'
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads/capas');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.geojson', '.json', '.zip'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .geojson, .json o .zip'));
    }
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

// POST /api/capas/:id/geojson
router.post('/:id/geojson', upload.single('archivo'), async (req, res) => {
  try {
    const { rows: capas } = await db.query('SELECT * FROM capa WHERE id = $1', [req.params.id]);
    if (!capas.length) return res.status(404).json({ error: 'Capa no encontrada' });

    const rutaRelativa = `uploads/capas/${req.file.originalname}`;
    const { rows } = await db.query(
      'UPDATE capa SET url_json = $1, actualizado_en = now() WHERE id = $2 RETURNING *',
      [rutaRelativa, req.params.id]
    );
    res.json({ ok: true, capa: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error subiendo GeoJSON' });
  }
});

module.exports = router;
EOF

echo ""
echo "✅ Backend creado. Estructura:"
find . -not -path '*/node_modules/*' -not -path '*/.git/*' | sort
