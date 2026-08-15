-- Track applied schema so runtime bootstrap cannot silently skip a partial D1.
INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '6');
UPDATE settings SET value = '6' WHERE key = 'schema_version';
