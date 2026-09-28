-- Forge v2: server-side payment records (sow.md Phase 2, step 6).
-- One row per PayPal order, created by POST /api/pay {action:"create"} and
-- moved to COMPLETED only by /api/pay {action:"capture"} after PayPal
-- confirms the capture and the captured amount/currency match this row.
-- This table, not the client's own `profile` section, is the source of
-- truth for whether a payment happened.
CREATE TABLE IF NOT EXISTS payments (
  id             TEXT PRIMARY KEY,
  order_id       TEXT UNIQUE NOT NULL,
  client_id      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  payer_user_id  TEXT NOT NULL,
  amount         TEXT NOT NULL,
  currency       TEXT NOT NULL,
  status         TEXT NOT NULL,
  description    TEXT,
  payer_email    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  raw            TEXT
);
CREATE INDEX IF NOT EXISTS payments_client_idx ON payments (client_id, created_at DESC);
