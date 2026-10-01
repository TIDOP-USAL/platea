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
    res.status(500).json({ error: 'Error obteniendo grupos.' });
  }
});

// GET /api/grupos/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM grupo WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Grupo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo grupo..' });
  }
});

// GET /api/grupos/seccion/:seccion
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
    res.json(grupos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
});

module.exports = router;
