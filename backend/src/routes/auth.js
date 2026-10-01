// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth, requireGuest } = require('../middleware/auth');

const router = express.Router();

// GET /admin/login — formulario de login
router.get('/login', requireGuest, (req, res) => {
  res.sendFile('login.html', { root: 'src/public/admin' });
});

// POST /admin/login — procesa credenciales
router.post('/login', requireGuest, express.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;
  console.log('[Auth] Login intento:', username);
  console.log('[Auth] Session ID antes:', req.session.id);
  if (!username || !password) {
    return res.redirect('/admin/login?error=campos_requeridos');
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND activo = TRUE',
      [username.trim().toLowerCase()]
    );

    const user = rows[0];
    if (!user) {
      return res.redirect('/admin/login?error=credenciales');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.redirect('/admin/login?error=credenciales');
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.nombre = user.nombre;

    req.session.save((err) => {
      if (err) {
        console.error('[Auth] Error guardando sesión:', err);
        return res.redirect('/admin/login?error=servidor');
      }
      console.log('[Auth] Sesión guardada, ID:', req.session.id);
      console.log('[Auth] Cookie config:', req.session.cookie);
      return res.redirect('/admin');
    });

  } catch (err) {
    console.error('[Auth] Error en login:', err);
    return res.redirect('/admin/login?error=servidor');
  }
});

// POST /admin/logout
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('platea.sid');
    res.redirect('/admin/login');
  });
});

// GET /admin/api/me — datos del usuario actual (para el JS del panel)
router.get('/api/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    username: req.session.username,
    nombre: req.session.nombre,
  });
});

module.exports = router;