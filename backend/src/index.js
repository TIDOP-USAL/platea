const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const cors    = require('cors');
const path    = require('path');

const capasRouter  = require('./routes/capas');
const gruposRouter = require('./routes/grupos');

const  pool  = require('./db');           // tu pool de PostgreSQL existente
const authRoutes = require('./routes/auth');
const adminCapasRoutes = require('./routes/admin-capas');
const adminUsersRoutes = require('./routes/admin-users');
const { requireAuth } = require('./middleware/auth');
const exportRouter = require('./routes/export');

const app  = express();
app.set('trust proxy', 1); 
const PgSession = connectPgSimple(session);
const PORT = process.env.PORT || 3000;

app.use('/api', cors());
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'session',   // connect-pg-simple crea esta tabla sola si le das el pool
    createTableIfMissing: true,
  }),
  name: 'platea.sid',
  secret: process.env.SESSION_SECRET,  // añade SESSION_SECRET a tu .env
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // true en prod (HTTPS)
    maxAge: 8 * 60 * 60 * 1000,   // 8 horas
    sameSite: 'lax',
  },
}));

app.use(express.json());



app.use('/uploads/capas', express.static(
  path.join(__dirname, '..', 'uploads', 'capas')
));

// ── Archivos estáticos del panel admin ──────────────────────
// Sirve login.html e index.html en /admin/login y /admin
app.use('/admin/static', express.static(path.join(__dirname, 'public/admin')));

// ── Rutas de auth (/admin/login, /admin/logout, /admin/api/me)
app.use('/admin', authRoutes);

// ── Panel admin (index.html) — protegido ────────────────────
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// ── API de capas — protegida ────────────────────────────────
app.use('/admin/api/capas', adminCapasRoutes);

// ── API de usuarios — protegida ─────────────────────────────
app.use('/admin/api/users', adminUsersRoutes);

// ── Tus rutas públicas existentes (API de la app móvil) ─────
// app.use('/api', tuRouterPublico);




app.use('/api/capas',  capasRouter);
app.use('/api/grupos', gruposRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Exportar datos a JSON / ZIP (no protegido) ─────────────
app.use('/api/export', exportRouter);

app.listen(PORT, () => {
  console.log(`PlateaGIS API corriendo en puerto ${PORT}`);
});

module.exports = app;