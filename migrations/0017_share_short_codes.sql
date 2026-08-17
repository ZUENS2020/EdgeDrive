-- Dual short codes: /s/{code} lands on download or preview (not the long /dl URL).
CREATE TABLE IF NOT EXISTS share_short_codes (
  code TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('download', 'view')),
  UNIQUE (token, mode)
);
CREATE INDEX IF NOT EXISTS idx_share_short_codes_token ON share_short_codes(token);

UPDATE settings SET value = '["download","preview","copy_download","copy_preview","expire","delete"]'
WHERE key = 'row_actions'
  AND value = '["download","preview","share","expire","delete"]';

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '17');
UPDATE settings SET value = '17' WHERE key = 'schema_version';
