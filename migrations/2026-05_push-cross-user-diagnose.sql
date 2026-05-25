-- ══════════════════════════════════════════════════════════════════
--  PUSH CROSS-USER BUG · diagnose (kør FØR fix)
--  Hypotese: én endpoint kan tilhøre flere brugere → forrige brugers
--  notifikationer lander hos den nye bruger på samme enhed.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Nuværende unique-constraints på push_subscriptions ──
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.push_subscriptions'::regclass
  AND contype IN ('u','p');
-- Forventet: UNIQUE (user_id, endpoint). Det er det der tillader to ejere af samme endpoint.

-- ── 2. RLS-policies på push_subscriptions ──
-- Afgør om en bruger kan slette/ændre EN ANDEN brugers række (nødvendigt for klient-side fix)
SELECT polname,
       CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS command,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
WHERE polrelid = 'public.push_subscriptions'::regclass;

-- ── 3. Findes der ALLEREDE dublet-endpoints på tværs af brugere? (bekræft bug'en lever) ──
SELECT endpoint, count(*) AS owners, array_agg(user_id) AS user_ids
FROM public.push_subscriptions
GROUP BY endpoint
HAVING count(*) > 1
ORDER BY owners DESC
LIMIT 20;
-- Hvis denne returnerer rækker: bug'en er aktiv i din DB lige nu (samme endpoint, flere user_ids).
