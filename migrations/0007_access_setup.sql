-- First-time Access setup: drop password/Better-Auth tables, add access_enabled.
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "verification";
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS admin;

INSERT OR IGNORE INTO settings (key, value) VALUES ('access_enabled', '0');

-- Existing installs that already stored Access team/aud stay fail-closed (already enabled).
UPDATE settings SET value = '1'
WHERE key = 'access_enabled'
  AND EXISTS (
    SELECT 1 FROM settings t
    WHERE t.key = 'cf_access_team' AND trim(t.value) != '' AND upper(t.value) != 'NULL'
  )
  AND EXISTS (
    SELECT 1 FROM settings a
    WHERE a.key = 'cf_access_aud' AND trim(a.value) != '' AND upper(a.value) != 'NULL'
  );

INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '7');
UPDATE settings SET value = '7' WHERE key = 'schema_version';
