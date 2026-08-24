PRAGMA foreign_keys = ON;

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL DEFAULT 1,
  theme_name TEXT NOT NULL DEFAULT 'onyx' CHECK (theme_name IN ('onyx', 'porcelain', 'nocturne')),
  language TEXT NOT NULL DEFAULT 'zh' CHECK (language IN ('zh', 'en')),
  page_size INTEGER NOT NULL DEFAULT 50 CHECK (page_size BETWEEN 10 AND 100),
  default_expires TEXT NOT NULL DEFAULT '24h',
  expired_retention_days INTEGER NOT NULL DEFAULT 7 CHECK (expired_retention_days BETWEEN 0 AND 3650),
  trash_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (trash_retention_days BETWEEN 1 AND 3650),
  access_enabled INTEGER NOT NULL DEFAULT 0 CHECK (access_enabled IN (0, 1)),
  cf_access_team TEXT NOT NULL DEFAULT '',
  cf_access_aud TEXT NOT NULL DEFAULT '',
  cron_secret TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_settings (id, cron_secret, created_at, updated_at)
VALUES (1, lower(hex(randomblob(32))), datetime('now'), datetime('now'));

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_folders_live_parent_name ON folders(COALESCE(parent_id, ''), name COLLATE NOCASE) WHERE deleted_at IS NULL;
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_deleted ON folders(deleted_at);

CREATE TABLE blobs (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64),
  size INTEGER NOT NULL CHECK (size >= 0),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'delete_pending')),
  created_at TEXT NOT NULL,
  delete_pending_at TEXT
);

CREATE INDEX idx_blobs_state ON blobs(state, delete_pending_at);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  blob_id TEXT NOT NULL REFERENCES blobs(id) ON DELETE RESTRICT,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime TEXT,
  expires_at TEXT,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_files_live_folder_name ON files(COALESCE(folder_id, ''), name COLLATE NOCASE) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_folder_created ON files(folder_id, created_at DESC, id DESC);
CREATE INDEX idx_files_created ON files(created_at DESC, id DESC);
CREATE INDEX idx_files_expires ON files(expires_at);
CREATE INDEX idx_files_deleted ON files(deleted_at);
CREATE INDEX idx_files_starred ON files(starred, created_at DESC);
CREATE INDEX idx_files_blob ON files(blob_id);

CREATE TABLE shares (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'batch')),
  password_hash TEXT,
  max_downloads INTEGER CHECK (max_downloads IS NULL OR max_downloads > 0),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  fail_count INTEGER NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  locked_until TEXT,
  allow_preview INTEGER NOT NULL DEFAULT 1 CHECK (allow_preview IN (0, 1)),
  allow_download INTEGER NOT NULL DEFAULT 1 CHECK (allow_download IN (0, 1))
);

CREATE INDEX idx_shares_created ON shares(created_at DESC, token DESC);
CREATE INDEX idx_shares_expires ON shares(expires_at);

CREATE TABLE share_items (
  share_token TEXT NOT NULL REFERENCES shares(token) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  PRIMARY KEY (share_token, file_id),
  UNIQUE (share_token, position)
);

CREATE INDEX idx_share_items_file ON share_items(file_id);

CREATE TABLE share_codes (
  code TEXT PRIMARY KEY,
  share_token TEXT NOT NULL REFERENCES shares(token) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('download', 'preview')),
  UNIQUE (share_token, mode)
);

CREATE INDEX idx_share_codes_token ON share_codes(share_token);

CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime TEXT,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  expected_size INTEGER NOT NULL CHECK (expected_size >= 0),
  storage_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT,
  state TEXT NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared', 'uploading', 'completing', 'complete', 'aborted')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  session_expires_at TEXT NOT NULL
);

CREATE INDEX idx_upload_sessions_expiry ON upload_sessions(session_expires_at, state);
