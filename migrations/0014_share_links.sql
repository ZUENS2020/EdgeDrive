-- Unified share links (file + batch) with password, limits, and short codes.
CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  password_hash TEXT,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  short_code TEXT UNIQUE,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_share_links_kind ON share_links(kind);
CREATE INDEX IF NOT EXISTS idx_share_links_target ON share_links(target);
CREATE INDEX IF NOT EXISTS idx_share_links_expires ON share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_share_links_created ON share_links(created_at);

INSERT OR IGNORE INTO share_links (
  token, kind, target, password_hash, max_downloads, download_count,
  created_at, expires_at, revoked, short_code, fail_count, locked_until
)
SELECT
  token,
  'batch',
  file_ids,
  NULL,
  NULL,
  0,
  created_at,
  expires_at,
  0,
  NULL,
  0,
  NULL
FROM batch_links;

UPDATE settings SET value = '["download","preview","share","copy_view_link","expire","delete"]'
WHERE key = 'row_actions'
  AND value = '["download","preview","copy_link","copy_view_link","expire","delete"]';

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '14');
UPDATE settings SET value = '14' WHERE key = 'schema_version';
