-- Application tables
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  mime TEXT,
  expires TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_path_name ON files(path, name);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_expires ON files(expires);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_parent_name ON folders(parent_id, name);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_name', 'EdgeDrive'),
  ('site_description', '边缘上的 Serverless 文件服务'),
  ('brand_color', '#171717'),
  ('page_size', '50'),
  ('default_expires', '24h'),
  ('home_kicker', 'ED'),
  ('home_cta', '进入后台'),
  ('home_dl_hint', '过期后下载返回 410。路径形如 /dl/文件路径。'),
  ('login_subtitle', '管理员登录'),
  ('admin_subtitle', 'Serverless'),
  ('footer_note', ''),
  ('show_admin_link', '1'),
  ('logo_text', 'ED'),
  ('purge_after_days', '7');
