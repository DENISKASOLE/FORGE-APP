-- Exercise library redesign, step 1: schema only. Additive - does not alter
-- or drop any existing column, table, or constraint.
--
-- Context for the reviewer: `exercise_library` already exists in production
-- but is currently empty (0 rows) and the app only ever reads `name` from it
-- (see useExerciseLibrary() in src/features/train/TrainScreens.jsx) - the
-- ~396 built-in exercises actually ship as a hardcoded JS array
-- (src/features/train/exerciseLibraryData.js) and only merge with any DB
-- rows by name. This migration turns that dormant table into the real,
-- coach-editable home for exercise taxonomy metadata: two tags (muscle
-- group + movement pattern) and three coaching cues per exercise. See
-- DECISIONS.md on branch feature/exercise-library for the full rationale.
--
-- REVIEW BEFORE RUNNING. Safe to run multiple times (every statement is
-- guarded to no-op if already applied).

-- 1. New columns on exercise_library. Nullable so any existing (unrelated)
--    columns and any future manual rows are unaffected.
alter table public.exercise_library
  add column if not exists muscle_group text,
  add column if not exists movement_pattern text,
  add column if not exists coaching_cues text[],
  add column if not exists needs_review boolean not null default false;

-- 2. Guard the two taxonomy columns to the exact allowed value sets, so a
--    future manual insert/edit can't silently introduce a new label. Left
--    off `name`/`id`/etc. entirely - this never touches pre-existing
--    columns or their constraints.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercise_library_muscle_group_check'
  ) then
    alter table public.exercise_library
      add constraint exercise_library_muscle_group_check
      check (muscle_group is null or muscle_group in (
        'Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes',
        'Calves', 'Biceps', 'Triceps', 'Core', 'Full body'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercise_library_movement_pattern_check'
  ) then
    alter table public.exercise_library
      add constraint exercise_library_movement_pattern_check
      check (movement_pattern is null or movement_pattern in (
        'Horizontal push', 'Vertical push', 'Horizontal pull', 'Vertical pull',
        'Squat', 'Hinge', 'Lunge', 'Carry', 'Rotation/Anti-rotation', 'Isolation'
      ));
  end if;
end $$;

-- 3. `name` needs to be a reliable upsert key for the seed step (and for
--    future coach-added rows) - add a uniqueness constraint only if the
--    column doesn't already have one under some other name.
do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'exercise_library'
      and con.contype in ('u', 'p')
      and att.attname = 'name'
  ) then
    alter table public.exercise_library add constraint exercise_library_name_key unique (name);
  end if;
end $$;
