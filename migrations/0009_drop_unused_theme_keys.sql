-- Theme system no longer uses per-site brand_color / custom_colors overlays.
DELETE FROM settings WHERE key IN ('brand_color', 'custom_colors');

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '9');
UPDATE settings SET value = '9' WHERE key = 'schema_version';
