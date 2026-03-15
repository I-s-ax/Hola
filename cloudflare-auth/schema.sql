-- Schema para Cloudflare D1
-- Ejecutar: wrangler d1 execute auth-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified INTEGER DEFAULT 0,
    verification_code TEXT,
    code_expiration TEXT,
    reset_code TEXT,
    reset_code_expiration TEXT,
    created_at TEXT NOT NULL
);

-- Índice para búsquedas rápidas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
