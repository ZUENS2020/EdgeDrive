-- Admin theme system: builtin themes (no per-site color overlay).
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme_name', 'default');

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '8');
UPDATE settings SET value = '8' WHERE key = 'schema_version';
