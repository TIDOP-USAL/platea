-- Tabla de usuarios administradores de PlateaGIS
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(64) UNIQUE NOT NULL,
  password    TEXT NOT NULL,          -- bcrypt hash
  nombre      VARCHAR(128),
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

-- Usuario admin por defecto (contraseña: changeme123 — cámbiala tras el primer login)
-- Hash generado con bcrypt rounds=12
-- Para regenerar: node -e "require('bcrypt').hash('changeme123',12).then(console.log)"
INSERT INTO users (username, password, nombre)
VALUES (
  'admin',
  '$2b$12$K8Zg3QwVz9Lm1Yp0Xn4TueA6FjR2sHdWcObNvPqMiEkGtCxBuJlY',
  'Administrador PlateaGIS'
) ON CONFLICT (username) DO NOTHING;
