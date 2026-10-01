// src/routes/admin-users.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren sesión
router.use(requireAuth);

// GET /admin/api/users — listar usuarios
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, nombre, activo, created_at, last_login FROM users ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error('[Users] Error listando usuarios:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /admin/api/users — crear usuario
router.post('/', async (req, res) => {
  const { username, password, nombre } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son obligatorios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password, nombre) VALUES ($1, $2, $3) RETURNING id, username, nombre, activo, created_at',
      [username.trim().toLowerCase(), hash, nombre || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    console.error('[Users] Error creando usuario:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PATCH /admin/api/users/:id — actualizar nombre, activo o contraseña
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, activo, password } = req.body;

  // No permitir desactivarse a uno mismo
  if (String(req.session.userId) === String(id) && activo === false) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); values.push(nombre); }
    if (activo !== undefined) { updates.push(`activo = $${idx++}`); values.push(activo); }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password = $${idx++}`);
      values.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, nombre, activo`,
      values
    );

    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Users] Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /admin/api/users/:id — eliminar usuario
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (String(req.session.userId) === String(id)) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Users] Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
