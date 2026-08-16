-- UI language: zh (default) or en. Admin + public pages.
INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'zh');

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '13');
UPDATE settings SET value = '13' WHERE key = 'schema_version';
