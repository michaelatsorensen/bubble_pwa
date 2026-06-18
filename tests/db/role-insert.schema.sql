-- Replica to answer: can a normal authenticated user INSERT a bubble_members row
-- with role='admin' for themselves? Models the REAL bubble_members INSERT policies
-- + the CURRENT role guard (BEFORE UPDATE only) and runs as the authenticated role.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true),'')::uuid $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;

CREATE TABLE public.profiles       (id uuid PRIMARY KEY, name text);
CREATE TABLE public.bubbles        (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, created_by uuid, visibility text);
CREATE TABLE public.bubble_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, user_id uuid, role text NOT NULL DEFAULT 'member', status text);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon;
ALTER TABLE public.bubble_members ENABLE ROW LEVEL SECURITY;

-- membership readable (so we can read back; also real policy)
CREATE POLICY "Alle kan se medlemmer" ON public.bubble_members FOR SELECT TO public USING (true);

-- ── the REAL bubble_members INSERT policies (verbatim from pg_policies) ──
CREATE POLICY "allow_pending_requests" ON public.bubble_members FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id) AND (status = 'pending')
              AND EXISTS (SELECT 1 FROM bubbles WHERE bubbles.id = bubble_members.bubble_id AND bubbles.visibility = 'private'));
CREATE POLICY "join_bubble_policy" ON public.bubble_members FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_can_checkin_others" ON public.bubble_members FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM bubbles WHERE bubbles.id = bubble_members.bubble_id AND bubbles.created_by = auth.uid()));

-- ── CURRENT role guard: BEFORE UPDATE only (verbatim) ──
CREATE OR REPLACE FUNCTION public.prevent_member_role_escalation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM bubbles WHERE id = NEW.bubble_id AND created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_member_role_guard
  BEFORE UPDATE ON public.bubble_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_role_escalation();
