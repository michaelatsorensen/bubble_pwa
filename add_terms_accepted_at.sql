-- Migration: Add terms_accepted_at to profiles
-- Run this in Supabase SQL Editor BEFORE deploying the new code
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
