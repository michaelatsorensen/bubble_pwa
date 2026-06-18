-- ─────────────────────────────────────────────────────────────────────
-- RLS privacy + integrity hardening
-- STATUS: reviewed + replica-proven (tests/db/run-rls-test.sh), NOT yet applied.
--         Apply in the Supabase SQL editor. Fully reversible — every dropped
--         policy can be recreated verbatim from the pg_policies dump.
--
-- Closes two cross-user holes proven by the RLS replica test, because Postgres
-- OR-combines permissive policies so the loosest wins:
--   1) bubble_messages: a member-only read gate was defeated by two `true`
--      policies, making all bubble chat readable by any authenticated user.
--   2) guest_checkins (name + title = PII): `auth_all_guest` (ALL/true) let any
--      authenticated user read, modify AND delete every check-in across events,
--      and `anon_*` (true) exposed them to unauthenticated reads.
--
-- Legitimate paths preserved (all proven green in the replica test):
--   member chat read; owner + admin guest read; owner + admin scanner check-in.
-- ─────────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1. bubble_messages: reads are member-only ──
DROP POLICY IF EXISTS "bubble_messages_select" ON public.bubble_messages;
DROP POLICY IF EXISTS "Authenticated users can view bubble messages" ON public.bubble_messages;
-- keep "Medlemmer kan læse boble-beskeder" (the member gate)

-- Belt-and-suspenders: also allow the bubble owner to read, in case any legacy
-- bubble has an owner who is not present as a bubble_members row (new bubbles
-- auto-add the creator as a member, so this only matters for old data).
DROP POLICY IF EXISTS "bubble_messages_owner_read" ON public.bubble_messages;
CREATE POLICY "bubble_messages_owner_read" ON public.bubble_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bubbles b WHERE b.id = bubble_messages.bubble_id AND b.created_by = auth.uid()));

-- ── 2. guest_checkins: only the bubble owner/admin can read/modify ──
DROP POLICY IF EXISTS "auth_all_guest"    ON public.guest_checkins;
DROP POLICY IF EXISTS "anon_read_guest"   ON public.guest_checkins;
DROP POLICY IF EXISTS "anon_select_guest" ON public.guest_checkins;
-- keep "anon_insert_guest" (guest self check-in path; insert-only, cannot read)

DROP POLICY IF EXISTS "guest_checkins_owner_admin" ON public.guest_checkins;
CREATE POLICY "guest_checkins_owner_admin" ON public.guest_checkins FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM bubbles b WHERE b.id = guest_checkins.bubble_id AND b.created_by = auth.uid())
           OR EXISTS (SELECT 1 FROM bubble_members m WHERE m.bubble_id = guest_checkins.bubble_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM bubbles b WHERE b.id = guest_checkins.bubble_id AND b.created_by = auth.uid())
           OR EXISTS (SELECT 1 FROM bubble_members m WHERE m.bubble_id = guest_checkins.bubble_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner')));

COMMIT;

-- After applying: mirror these changes in tests/db/rls.schema.sql (drop the same
-- loose policies, add the two above) and run `bash tests/db/run-rls-test.sh` —
-- it should go 10/10 green and then stays as a regression guard.
