-- Admin theme system: builtin themes + optional color overrides.
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme_name', 'default');
INSERT OR IGNORE INTO settings (key, value) VALUES ('custom_colors', '');

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '8');
UPDATE settings SET value = '8' WHERE key = 'schema_version';
