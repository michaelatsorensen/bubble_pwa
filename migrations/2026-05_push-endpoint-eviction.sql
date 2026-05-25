-- ══════════════════════════════════════════════════════════════════
--  PUSH CROSS-USER FIX (maj 2026) — DEPLOYED
--  Problem: UNIQUE(user_id, endpoint) tillod ét fysisk endpoint at
--  tilhøre flere brugere. Forrige brugers notifikationer landede hos
--  ny bruger på samme enhed (privacy-leak + forkerte notifikationer).
--  Logout-cleanup fandtes men var skrøbelig (fejlede tavst ved session-
--  expiry, test-switch, app-kill, currentUser=null).
--
--  RLS er auth.uid()=user_id (ALL) → klienten kan IKKE rydde anden
--  brugers række → fix skal være server-side (SECURITY DEFINER trigger).
--
--  Invariant: ét endpoint = én enhed = én bruger ad gangen. Seneste
--  login ejer endpointet eksklusivt.
-- ══════════════════════════════════════════════════════════════════

-- 1. Engangs-oprydning af eksisterende dubletter (behold seneste pr. endpoint)
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.endpoint = b.endpoint
  AND a.user_id <> b.user_id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

-- 2. Beskyttelses-trigger (data-integritet, ikke side-effekt)
CREATE OR REPLACE FUNCTION public.evict_stale_push_endpoint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE endpoint = NEW.endpoint AND user_id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evict_stale_push_endpoint ON public.push_subscriptions;
CREATE TRIGGER trg_evict_stale_push_endpoint
  BEFORE INSERT ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.evict_stale_push_endpoint();
