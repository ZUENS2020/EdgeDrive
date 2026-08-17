-- Share access quadrant: allow_download (preview-only shares).
ALTER TABLE share_links ADD COLUMN allow_download INTEGER NOT NULL DEFAULT 1;

UPDATE settings SET value = '["download","preview","share","expire","delete"]'
WHERE key = 'row_actions'
  AND value = '["download","preview","share","copy_view_link","expire","delete"]';

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '16');
UPDATE settings SET value = '16' WHERE key = 'schema_version';
