-- Per-file download counters for batch shares; pack-only mode (allow_preview=0).
CREATE TABLE IF NOT EXISTS share_file_counts (
  token TEXT NOT NULL,
  file_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (token, file_id)
);

ALTER TABLE share_links ADD COLUMN allow_preview INTEGER NOT NULL DEFAULT 1;

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '15');
UPDATE settings SET value = '15' WHERE key = 'schema_version';
