-- Product copy is hardcoded as EdgeDrive. Align leftover settings rows.
UPDATE settings SET value = 'EdgeDrive' WHERE key = 'site_name';
UPDATE settings SET value = '边缘上的 Serverless 文件服务' WHERE key = 'site_description';
UPDATE settings SET value = 'ED' WHERE key = 'home_kicker';
UPDATE settings SET value = '进入后台' WHERE key = 'home_cta';
UPDATE settings SET value = '过期后下载返回 410。路径形如 /dl/文件路径。' WHERE key = 'home_dl_hint';
UPDATE settings SET value = '管理员登录' WHERE key = 'login_subtitle';
UPDATE settings SET value = 'Serverless' WHERE key = 'admin_subtitle';
UPDATE settings SET value = '' WHERE key = 'footer_note';
UPDATE settings SET value = '1' WHERE key = 'show_admin_link';
UPDATE settings SET value = 'ED' WHERE key = 'logo_text';
