-- Drive enhancements: trash (soft delete), star, instant-upload hash.
ALTER TABLE files ADD COLUMN deleted_at TEXT;
ALTER TABLE files ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN sha256 TEXT;

DROP INDEX IF EXISTS idx_files_path_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_alive_path_name ON files(path, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(starred);
CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files(sha256);

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '11');
UPDATE settings SET value = '11' WHERE key = 'schema_version';
