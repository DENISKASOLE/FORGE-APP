-- Forge v2 file storage bookkeeping (R2 free-tier guard).
-- One row per object in the FILES R2 bucket, keyed "<bucket>/<path>".
-- file_usage keeps a running total (maintained by triggers) so the upload
-- path reads one row instead of summing the whole table.

CREATE TABLE IF NOT EXISTS file_objects (
  key            TEXT PRIMARY KEY,
  size           INTEGER NOT NULL CHECK (size >= 0),
  content_type   TEXT,
  owner_user_id  TEXT,
  etag           TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS file_usage (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  total_bytes    INTEGER NOT NULL DEFAULT 0,
  total_objects  INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO file_usage (id, total_bytes, total_objects) VALUES (1, 0, 0);

CREATE TRIGGER IF NOT EXISTS file_objects_usage_insert
AFTER INSERT ON file_objects FOR EACH ROW
BEGIN
  UPDATE file_usage
     SET total_bytes = total_bytes + NEW.size, total_objects = total_objects + 1
   WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS file_objects_usage_update
AFTER UPDATE OF size ON file_objects FOR EACH ROW
BEGIN
  UPDATE file_usage SET total_bytes = total_bytes + NEW.size - OLD.size WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS file_objects_usage_delete
AFTER DELETE ON file_objects FOR EACH ROW
BEGIN
  UPDATE file_usage
     SET total_bytes = total_bytes - OLD.size, total_objects = total_objects - 1
   WHERE id = 1;
END;

-- Per-user daily upload counter (protects the R2 Class A op budget).
-- user_id '*' holds the global counter across all users.
CREATE TABLE IF NOT EXISTS file_upload_counts (
  user_id  TEXT NOT NULL,
  day      TEXT NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
