-- ══════════════════════════════════════════════════════════
--  BUBBLE v5.0.0 — MIGRATION
--  Run in Supabase SQL editor ONCE before deploying v5.0.0.
--  Safe to re-run (all statements use IF NOT EXISTS / IF NULL).
-- ══════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────
--  1. PROFILES — tier-based scoring columns
-- ────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sectors        text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS life_phase     text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_sector   text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_v        integer DEFAULT 5;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_sectors
  ON profiles USING GIN (sectors);

CREATE INDEX IF NOT EXISTS idx_profiles_life_phase
  ON profiles (life_phase)
  WHERE life_phase IS NOT NULL;

-- Backfill score_v for existing profiles
UPDATE profiles
  SET score_v = 5
  WHERE score_v IS NULL;


-- ────────────────────────────────────────────────────────
--  2. BUBBLES — event + hierarchy columns
-- ────────────────────────────────────────────────────────
ALTER TABLE bubbles
  ADD COLUMN IF NOT EXISTS starts_at          timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ends_at            timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_bubble_id   uuid        DEFAULT NULL
    REFERENCES bubbles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_mode       text        DEFAULT 'open';

-- Index for event queries (time-based sorting)
CREATE INDEX IF NOT EXISTS idx_bubbles_starts_at
  ON bubbles (starts_at)
  WHERE starts_at IS NOT NULL;

-- Index for parent → child lookups
CREATE INDEX IF NOT EXISTS idx_bubbles_parent
  ON bubbles (parent_bubble_id)
  WHERE parent_bubble_id IS NOT NULL;


-- ────────────────────────────────────────────────────────
--  3. VERIFICATION — confirm all columns exist
-- ────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE
  (table_name = 'profiles'
    AND column_name IN ('sectors','life_phase','match_sector','score_v'))
  OR
  (table_name = 'bubbles'
    AND column_name IN ('starts_at','ends_at','parent_bubble_id','checkin_mode'))
ORDER BY table_name, column_name;
