-- Bookkeeping for the Supabase -> Cloudflare cutover route (/api/admin/migrate).
-- Keys:
--   step:<name>          last run of a step: {done, processed, nextCursor, at}
--   bucketcount:<bucket> object count seen in Supabase on the last full file pass
--   verify:last          the last verify table
--   email:<user id>      a password-setup email was sent to this user (never re-sent)
-- Safe to leave in place after cutover; nothing in the app reads it.
CREATE TABLE IF NOT EXISTS migration_log (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS migration_log_updated_idx ON migration_log (updated_at);
