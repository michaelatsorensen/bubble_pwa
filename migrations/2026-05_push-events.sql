-- ══════════════════════════════════════════════════════════════════
--  ADR-006 · TRIN 2: push_events observability-tabel
--  Kør i Supabase SQL Editor. Sikker at køre (idempotent).
--
--  Formål: synlighed FØR vi rører dispatch. Afslører dubletter, fejl,
--  kilde og modtager — så vi trygt kan reparere triggers og cutover.
--
--  BEVIDST: ingen FK på recipient_user_id. En FK NO ACTION ville gøre
--  denne diagnose-log til endnu en sletnings-blokering (jf. Q-014).
--  En plain uuid blokerer aldrig brugersletning; retention rydder senere.
--
--  PILOT-VÆRKTØJ, ikke permanent audit-log. Sæt retention-politik senere.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type        text,          -- 'new_message' | 'bubble_invite' | 'contact_saved' | ...
  recipient_user_id uuid,          -- BEVIDST ingen FK (se header)
  source            text,          -- 'trigger' | 'frontend' | 'edge' | 'unknown'
  status            text,          -- 'sent' | 'failed' | 'no_subscription' | 'invalid'
  sent_count        int,           -- antal enheder pushen nåede (multi-device)
  error             text,          -- provider/edge fejlbesked, nullable
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index til de typiske diagnose-queries: nyeste først, og pr. modtager
CREATE INDEX IF NOT EXISTS idx_push_events_created    ON public.push_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_events_recipient  ON public.push_events (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_events_type       ON public.push_events (event_type, created_at DESC);

-- ── RLS: diagnose-log med modtager-info → lås helt ned ──
-- Edge function skriver via service_role (bypasser RLS).
-- Ingen anon/authenticated-policies = default deny. Kun service_role + admin (via service key) kan læse.
ALTER TABLE public.push_events ENABLE ROW LEVEL SECURITY;

-- (Ingen policies tilføjet med vilje — RLS uden policies = ingen adgang for anon/authenticated.
--  service_role bypasser RLS, så edge function kan skrive og du kan læse via SQL Editor.)

-- ── Verifikation: bekræft tabellen findes ──
SELECT 'push_events oprettet' AS status,
       count(*) AS rows_so_far
FROM public.push_events;

-- ── Nyttige diagnose-queries til SENERE (under migration) ──
-- Se de seneste 50 push-events:
--   SELECT created_at, event_type, source, status, sent_count, recipient_user_id
--   FROM push_events ORDER BY created_at DESC LIMIT 50;
--
-- Find DUBLETTER (samme event til samme modtager fra flere kilder inden for 10 sek):
--   SELECT recipient_user_id, event_type, count(*), array_agg(source)
--   FROM push_events
--   WHERE created_at > now() - interval '1 hour'
--   GROUP BY recipient_user_id, event_type, date_trunc('second', created_at)
--   HAVING count(*) > 1;
--
-- Find TAVSE FEJL pr. kilde:
--   SELECT source, status, count(*) FROM push_events
--   WHERE created_at > now() - interval '1 day'
--   GROUP BY source, status ORDER BY source, status;
