-- Replica for the production role-escalation guard on bubble_members.
-- Models ONLY the trigger layer (RLS is a separate layer, not modelled here):
-- the guarantee that even a direct UPDATE cannot escalate a member role.
CREATE SCHEMA IF NOT EXISTS auth;

-- test-only: holds the "current user" so auth.uid() is switchable per scenario
CREATE TABLE public._test_ctx (singleton boolean PRIMARY KEY DEFAULT true, uid uuid);
INSERT INTO public._test_ctx(singleton, uid) VALUES (true, NULL);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT uid FROM public._test_ctx WHERE singleton LIMIT 1
$$;

CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text);
CREATE TABLE public.bubbles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text,
  created_by uuid REFERENCES public.profiles(id)
);
CREATE TABLE public.bubble_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bubble_id uuid REFERENCES public.bubbles(id) ON DELETE CASCADE,
  user_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  last_active timestamptz,
  UNIQUE (bubble_id, user_id)
);

-- ── production trigger function, verbatim (pg_get_functiondef) ──
CREATE OR REPLACE FUNCTION public.prevent_member_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Bubble owner kan alt
  IF EXISTS (SELECT 1 FROM bubbles WHERE id = NEW.bubble_id AND created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Non-owner: bevar original role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$function$;

-- ⚠ ASSUMED firing condition — confirm against pg_get_triggerdef (query 1).
-- (Function uses OLD+NEW.role, so BEFORE UPDATE row-level is near-certain; an
--  INSERT trigger would null roles on join, which would break joining.)
CREATE TRIGGER trg_prevent_member_role_escalation
  BEFORE UPDATE ON public.bubble_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_role_escalation();
