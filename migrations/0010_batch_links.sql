-- Batch share links: one token → many files (preview page + auto-download mode).
CREATE TABLE IF NOT EXISTS batch_links (
  token TEXT PRIMARY KEY,
  file_ids TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_batch_expires ON batch_links(expires_at);

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '10');
UPDATE settings SET value = '10' WHERE key = 'schema_version';
