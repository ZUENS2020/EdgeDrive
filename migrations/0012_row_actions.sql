-- Configurable file-row action icons.
INSERT OR IGNORE INTO settings (key, value) VALUES ('row_actions', '["download","preview","copy_link","copy_view_link","expire","delete"]');

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '12');
UPDATE settings SET value = '12' WHERE key = 'schema_version';
