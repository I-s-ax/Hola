-- Schema para Cloudflare D1
-- Ejecutar: wrangler d1 execute auth-db --file=./schema.sql

-- Tabla de usuarios (ya existe)
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Tabla de conexiones a nubes (Google Drive, etc.)
CREATE TABLE IF NOT EXISTS cloud_connections (
    connection_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TEXT,
    provider_email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_user ON cloud_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_provider ON cloud_connections(provider);

-- Tabla de tarjetas
CREATE TABLE IF NOT EXISTS cards (
    card_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    cover_file_id TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_public ON cards(is_public);

-- Tabla de archivos multimedia de las tarjetas
CREATE TABLE IF NOT EXISTS card_files (
    file_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT,
    thumbnail_url TEXT,
    file_size INTEGER,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(card_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_files_card ON card_files(card_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON card_files(user_id);
