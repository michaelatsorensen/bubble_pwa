-- ═══════════════════════════════════════════════════════════════════════
--  C · Trin 2: opret bubble_join_requests
--
--  Ren model: join-requests bor HER, ikke i bubble_members. Så bubble_members
--  indeholder kun rigtige medlemmer, og enhver tælling er korrekt automatisk.
--
--  RLS matcher den FAKTISKE adgangsmodel (verificeret i kode):
--    - Bruger opretter/ser/sletter (fortryder) sin EGEN request
--    - Ejer ELLER admin ser + sletter (afviser) requests for sin boble
--    - Godkendelse går KUN via approve_join_request-RPC (trin 3), ikke direkte
--
--  Bemærk: skabelonen bubble_invitations har DUPLIKEREDE politikker (teknisk gæld).
--  Vi kopierer IKKE det rod — én ren politik pr. operation.
--
--  KØR STATEMENT FOR STATEMENT. Bekræft efter hvert.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══ STATEMENT 1: Selve tabellen ═══
create table if not exists public.bubble_join_requests (
  id          uuid primary key default gen_random_uuid(),
  bubble_id   uuid not null references public.bubbles(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (bubble_id, user_id)   -- kan ikke ansøge to gange til samme boble
);


-- ═══ STATEMENT 2: Slå RLS til ═══
alter table public.bubble_join_requests enable row level security;


-- ═══ STATEMENT 3: INSERT — man ansøger kun for sig selv ═══
create policy "join_req_insert_own"
  on public.bubble_join_requests
  for insert
  with check (auth.uid() = user_id);


-- ═══ STATEMENT 4: SELECT — egen request, ELLER ejer/admin af boblen ═══
create policy "join_req_select_own_or_manager"
  on public.bubble_join_requests
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.bubbles b
      where b.id = bubble_join_requests.bubble_id
        and b.created_by = auth.uid()
    )
    or exists (
      select 1 from public.bubble_members m
      where m.bubble_id = bubble_join_requests.bubble_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );


-- ═══ STATEMENT 5: DELETE — egen (fortryd), ELLER ejer/admin (afvis) ═══
create policy "join_req_delete_own_or_manager"
  on public.bubble_join_requests
  for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.bubbles b
      where b.id = bubble_join_requests.bubble_id
        and b.created_by = auth.uid()
    )
    or exists (
      select 1 from public.bubble_members m
      where m.bubble_id = bubble_join_requests.bubble_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- Bemærk: INGEN update-politik. En request ændres ikke — den oprettes, slettes
-- (fortryd/afvis), eller konverteres til medlemskab via RPC (trin 3).
