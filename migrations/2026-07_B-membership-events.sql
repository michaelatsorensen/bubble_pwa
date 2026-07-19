-- ═══════════════════════════════════════════════════════════════════════
--  B: bubble_membership_events — historik over til/afmeldinger
--  KØRT + VERIFICERET mod prod 19. jul 2026 (trinvist).
--
--  Model: bubble_members = medlem NU. Denne tabel = historik via delta-kolonne
--  (+1 joined, -1 left, N baseline). Løbende sum af delta = medlemstal over tid.
--  Trigger fanger alle til/afmeldinger automatisk. Baseline per boble = dens
--  nuværende member_count (ærligt anker, dateret til migreringsdag).
--  Verificeret: 64 bobler med medlemmer = 64 baseline-punkter. HoS = 3.
-- ═══════════════════════════════════════════════════════════════════════

-- Tabellen
create table public.bubble_membership_events (
  id         uuid primary key default gen_random_uuid(),
  bubble_id  uuid not null references public.bubbles(id) on delete cascade,
  user_id    uuid,
  event_type text not null,          -- 'joined' | 'left' | 'baseline'
  delta      int  not null,          -- +1 / -1 / N (baseline)
  created_at timestamptz not null default now()
);
create index idx_membership_events_bubble on public.bubble_membership_events(bubble_id, created_at);

-- RLS: kun ejer/admin læser (grafen er admin-værktøj). Kun trigger skriver.
alter table public.bubble_membership_events enable row level security;

create policy "membership_events_select_manager"
  on public.bubble_membership_events
  for select
  using (
    exists (select 1 from public.bubbles b
      where b.id = bubble_membership_events.bubble_id and b.created_by = auth.uid())
    or exists (select 1 from public.bubble_members m
      where m.bubble_id = bubble_membership_events.bubble_id
        and m.user_id = auth.uid() and m.role = 'admin')
  );

-- Trigger-funktion: skriv hændelse ved til/afmelding.
create or replace function public.log_membership_event()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if TG_OP = 'INSERT' then
    insert into bubble_membership_events (bubble_id, user_id, event_type, delta)
    values (NEW.bubble_id, NEW.user_id, 'joined', 1);
  elsif TG_OP = 'DELETE' then
    insert into bubble_membership_events (bubble_id, user_id, event_type, delta)
    values (OLD.bubble_id, OLD.user_id, 'left', -1);
  end if;
  return null;
end;
$function$;

create trigger trg_log_membership_event
  after insert or delete on public.bubble_members
  for each row execute function public.log_membership_event();

-- Baseline-seed: ét punkt per boble med medlemmer = dens nuværende member_count.
insert into bubble_membership_events (bubble_id, user_id, event_type, delta, created_at)
select id, null, 'baseline', coalesce(member_count, 0), now()
from bubbles
where coalesce(member_count, 0) > 0;
