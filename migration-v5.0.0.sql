-- ══════════════════════════════════════════════════════════
--  BUBBLE v5.0.0 — MIGRATION
--  Adds sector, life_phase, sectors[], life_phase columns
--  to profiles table for tier-based match scoring.
--
--  Run in Supabase SQL editor ONCE before deploying v5.0.0.
-- ══════════════════════════════════════════════════════════

-- 1. Add sector-related columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sectors      text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS life_phase   text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_sector text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_v      integer  DEFAULT 5;

-- 2. Index for sector queries (array containment)
CREATE INDEX IF NOT EXISTS idx_profiles_sectors
  ON profiles USING GIN (sectors);

-- 3. Index for life_phase filtering
CREATE INDEX IF NOT EXISTS idx_profiles_life_phase
  ON profiles (life_phase)
  WHERE life_phase IS NOT NULL;

-- 4. Backfill: set score_v = 5 for all existing profiles
--    (JS will recalculate on next radar load)
UPDATE profiles
  SET score_v = 5
  WHERE score_v IS NULL;

-- ── Verification ──
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('sectors','life_phase','match_sector','score_v')
ORDER BY column_name;
