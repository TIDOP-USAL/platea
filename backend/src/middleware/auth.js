// src/middleware/auth.js

/**
 * Protege rutas que requieren sesión activa de admin.
 * Si no hay sesión redirige a /admin/login (para HTML)
 * o devuelve 401 JSON (para rutas /api/*).
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  const isApiCall = req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json';
  if (isApiCall) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return res.redirect('/admin/login');
}

/**
 * Evita que un usuario ya logueado vea la pantalla de login.
 */
function requireGuest(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/admin');
  }
  return next();
}

module.exports = { requireAuth, requireGuest };
