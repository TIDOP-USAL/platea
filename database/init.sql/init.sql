-- ─── PlateaGIS — schema PostgreSQL ─────────────────────────────────────────
-- Mismos nombres de campo que el SQLite de Android para mantener consistencia
-- Ejecutar en la DB plateagis antes de arrancar el backend

CREATE TABLE IF NOT EXISTS seccion (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS grupo (
  id         SERIAL PRIMARY KEY,
  id_seccion INTEGER NOT NULL REFERENCES seccion(id) ON DELETE CASCADE,
  nombre     TEXT    NOT NULL,
  orden      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capa (
  id            SERIAL PRIMARY KEY,
  id_grupo      INTEGER NOT NULL REFERENCES grupo(id) ON DELETE CASCADE,
  tipo          TEXT,
  texto         TEXT    NOT NULL,
  imagen        TEXT,
  nombre_source TEXT,
  url_json   TEXT,
  url           TEXT,
  capa_wms      TEXT,
  color         TEXT,
  grosor        REAL,
  checked       BOOLEAN NOT NULL DEFAULT FALSE,
  orden         INTEGER NOT NULL DEFAULT 0
);

-- ─── Tabla de sesiones (connect-pg-simple la gestiona automáticamente) ───────
-- No hace falta crearla manualmente si usas createTableIfMissing: true
-- pero se incluye por si quieres crearla explícitamente:
-- CREATE TABLE IF NOT EXISTS "session" (
--   "sid"    VARCHAR    NOT NULL COLLATE "default",
--   "sess"   JSON       NOT NULL,
--   "expire" TIMESTAMP  NOT NULL,
--   CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
-- );

-- ─── Tabla de usuarios administradores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(64) UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  nombre     VARCHAR(128),
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Usuario admin por defecto — contraseña: changeme123
-- Cámbiala desde el panel tras el primer login
-- Para regenerar el hash: node -e "require('bcrypt').hash('changeme123',12).then(console.log)"
INSERT INTO users (username, password, nombre)
VALUES (
  'admin',
  '$2b$12$K8Zg3QwVz9Lm1Yp0Xn4TueA6FjR2sHdWcObNvPqMiEkGtCxBuJlY',
  'Administrador PlateaGIS'
) ON CONFLICT (username) DO NOTHING;