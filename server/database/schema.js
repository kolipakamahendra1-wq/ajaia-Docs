export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
     name          TEXT    NOT NULL,
     password_hash TEXT    NOT NULL,
     created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `CREATE TABLE IF NOT EXISTS documents (
     id          TEXT    PRIMARY KEY,
     owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title       TEXT    NOT NULL,
     content     TEXT    NOT NULL,
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `CREATE TABLE IF NOT EXISTS document_shares (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     document_id  TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role         TEXT    NOT NULL CHECK (role IN ('viewer','editor')),
     created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     UNIQUE (document_id, user_id)
   )`,
  'CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id)',
];
