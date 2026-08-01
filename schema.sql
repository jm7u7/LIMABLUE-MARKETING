-- Esquema de referencia. La app lo crea SOLA (ensureSchema en api/_lib.js),
-- así que normalmente NO necesitas correr esto a mano.

CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  email         text UNIQUE NOT NULL,
  nombre        text NOT NULL,
  cargo         text NOT NULL DEFAULT 'otros',
  password_hash text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_store (
  scope      text NOT NULL,            -- 'shared' (datos del equipo) o el id del usuario
  key        text NOT NULL,            -- p.ej. 'marketing-tasks-v2', 'actas-reuniones'
  value      text NOT NULL,            -- JSON serializado
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (scope, key)
);
