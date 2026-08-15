-- Product copy is hardcoded as Server Less Drive / SLD.
-- Align leftover settings rows from earlier installs.
UPDATE settings SET value = 'Server Less Drive' WHERE key = 'site_name';
UPDATE settings SET value = '带有效期的文件直链' WHERE key = 'site_description';
UPDATE settings SET value = 'SLD' WHERE key = 'home_kicker';
UPDATE settings SET value = '进入后台' WHERE key = 'home_cta';
UPDATE settings SET value = '公开地址：/dl/文件路径' WHERE key = 'home_dl_hint';
UPDATE settings SET value = '管理员登录' WHERE key = 'login_subtitle';
UPDATE settings SET value = 'SLD' WHERE key = 'admin_subtitle';
UPDATE settings SET value = '' WHERE key = 'footer_note';
UPDATE settings SET value = '1' WHERE key = 'show_admin_link';
UPDATE settings SET value = 'SLD' WHERE key = 'logo_text';
