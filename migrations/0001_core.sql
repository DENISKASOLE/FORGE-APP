-- Forge v2 core schema (D1 / SQLite), ported from the Supabase Postgres
-- schema. Column sets for clients/trainers are inferred from app usage;
-- reconcile against `supabase db dump` before cutover (see sow.md Phase 0).
-- Conventions: ids are TEXT uuids, timestamps are ISO-8601 TEXT (UTC),
-- JSON columns are TEXT holding JSON, booleans are INTEGER 0/1.

CREATE TABLE IF NOT EXISTS trainers (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'Coach',
  phone       TEXT NOT NULL DEFAULT '',
  photo       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id              TEXT PRIMARY KEY,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  client_user_id  TEXT UNIQUE,
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  age             INTEGER NOT NULL DEFAULT 0,
  weight_kg       REAL NOT NULL DEFAULT 0,
  goal            TEXT NOT NULL DEFAULT '',
  injuries        TEXT NOT NULL DEFAULT '',
  photo           TEXT NOT NULL DEFAULT '',
  color           TEXT NOT NULL DEFAULT '',
  invite_code     TEXT UNIQUE,
  invite_status   TEXT NOT NULL DEFAULT 'not_sent',
  -- Any Postgres column the migrator finds that this table lacks is kept
  -- here as JSON rather than silently dropped.
  extra           TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS clients_trainer_idx ON clients (trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clients_email_idx ON clients (lower(email));

CREATE TABLE IF NOT EXISTS client_data (
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (client_id, section)
);

CREATE TABLE IF NOT EXISTS trainer_data (
  trainer_id  TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (trainer_id, section)
);

CREATE TABLE IF NOT EXISTS health_screenings (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  screening_version  TEXT NOT NULL,
  answers            TEXT NOT NULL,
  needs_clearance    INTEGER NOT NULL DEFAULT 0,
  signed_name        TEXT NOT NULL,
  signature_path     TEXT NOT NULL,
  pdf_path           TEXT NOT NULL,
  consents           TEXT NOT NULL,
  signed_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS health_screenings_client_idx ON health_screenings (client_id, signed_at DESC);

CREATE TABLE IF NOT EXISTS buddy_pairs (
  id          TEXT PRIMARY KEY,
  coach_id    TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  name        TEXT,
  slot_label  TEXT,
  price       REAL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS buddy_pairs_coach_idx ON buddy_pairs (coach_id);

CREATE TABLE IF NOT EXISTS buddy_members (
  pair_id    TEXT NOT NULL REFERENCES buddy_pairs(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  joined_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (pair_id, client_id)
);
CREATE INDEX IF NOT EXISTS buddy_members_pair_idx ON buddy_members (pair_id);

CREATE TRIGGER IF NOT EXISTS buddy_pairs_set_updated_at
AFTER UPDATE ON buddy_pairs FOR EACH ROW
BEGIN
  UPDATE buddy_pairs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS buddy_members_max_two
BEFORE INSERT ON buddy_members FOR EACH ROW
WHEN (SELECT count(*) FROM buddy_members WHERE pair_id = NEW.pair_id) >= 2
BEGIN
  SELECT RAISE(ABORT, 'A buddy pair can have at most two members');
END;

CREATE TABLE IF NOT EXISTS exercise_library (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  muscle_group      TEXT CHECK (muscle_group IS NULL OR muscle_group IN (
                      'Chest','Back','Shoulders','Quads','Hamstrings','Glutes',
                      'Calves','Biceps','Triceps','Core','Full body')),
  movement_pattern  TEXT CHECK (movement_pattern IS NULL OR movement_pattern IN (
                      'Horizontal push','Vertical push','Horizontal pull','Vertical pull',
                      'Squat','Hinge','Lunge','Carry','Rotation/Anti-rotation','Isolation')),
  coaching_cues     TEXT NOT NULL DEFAULT '[]',
  needs_review      INTEGER NOT NULL DEFAULT 0,
  extra             TEXT NOT NULL DEFAULT '{}'
);
