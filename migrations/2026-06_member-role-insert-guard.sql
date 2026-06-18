-- ─────────────────────────────────────────────────────────────────────
-- bubble_members role guard: also enforce on INSERT
-- STATUS: reviewed + replica-proven (tests/db/run-role-insert-test.sh), NOT yet
--         applied. Apply in the Supabase SQL editor. Reversible — restore the
--         previous BEFORE-UPDATE-only trigger from history if needed.
--
-- Why: the trigger trg_member_role_guard previously fired only BEFORE UPDATE, so
-- a normal user could INSERT their own bubble_members row with role='admin'
-- (join_bubble_policy's WITH CHECK only verifies user_id = auth.uid(), not role).
-- The replica test proves this: a regular user self-inserts as 'admin'.
--
-- Fix: fire the same guard on INSERT too. Non-owners are forced to role='member'
-- on insert; the bubble owner is still allowed to set any role (check-in others,
-- create admins). UPDATE behaviour is unchanged. Proven green for: attacker
-- self-insert -> member; owner check-in -> works; owner can create admin; UPDATE
-- escalation still blocked.
-- ─────────────────────────────────────────────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_member_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Bubble owner kan alt (oprette admins, checke andre ind)
  IF EXISTS (SELECT 1 FROM bubbles WHERE id = NEW.bubble_id AND created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Non-owner: join altid som 'member', uanset hvad klienten sender
    NEW.role := 'member';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Non-owner: bevar original role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_member_role_guard ON public.bubble_members;
CREATE TRIGGER trg_member_role_guard
  BEFORE INSERT OR UPDATE ON public.bubble_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_role_escalation();

COMMIT;

-- After applying: the role-insert replica test goes green; keep it as a guard.
