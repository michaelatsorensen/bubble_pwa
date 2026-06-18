\set ON_ERROR_STOP on
-- U1 = owner+member of B; U2 = non-member; U3 = third party; U4 = ADMIN member of B
INSERT INTO public.profiles(id,name,role) VALUES
 ('11111111-1111-1111-1111-111111111111','U1','user'),
 ('22222222-2222-2222-2222-222222222222','U2','user'),
 ('33333333-3333-3333-3333-333333333333','U3','user'),
 ('44444444-4444-4444-4444-444444444444','U4','user');
INSERT INTO public.bubbles(id,name,created_by,visibility) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','B','11111111-1111-1111-1111-111111111111','public');
-- owner auto-joins as member (createBubble does this); U4 is an admin member
INSERT INTO public.bubble_members(bubble_id,user_id,role,status) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin','active'),
 ('bbbbbbbb-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','admin','active');
INSERT INTO public.bubble_messages(id,bubble_id,user_id,content) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','hemmelig boble-besked');
INSERT INTO public.bubble_posts(id,bubble_id,author_id,content) VALUES
 ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','hemmeligt opslag');
INSERT INTO public.messages(id,sender_id,receiver_id,content) VALUES
 ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','privat DM');
-- one guest checkin (name + title = PII) in B, not yet checked in
INSERT INTO public.guest_checkins(id,bubble_id,name,title) VALUES
 ('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','Gaest Navn','Udvikler');

CREATE TEMP TABLE _r (ord serial, name text, got int, want int);

-- ── READS ──
-- POSITIVE CONTROL: member U1 CAN read the bubble message
SET test.uid='11111111-1111-1111-1111-111111111111'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM bubble_messages WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('[kontrol] medlem laeser boble-besked', :c, 1);

-- non-member U2 reads bubble_messages -> SHOULD be 0
SET test.uid='22222222-2222-2222-2222-222222222222'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM bubble_messages WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('ikke-medlem laeser boble-CHAT', :c, 0);

-- non-member U2 reads bubble_posts -> SHOULD be 0
SET test.uid='22222222-2222-2222-2222-222222222222'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM bubble_posts WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('ikke-medlem laeser boble-OPSLAG', :c, 0);

-- uninvolved U2 reads a DM between U1 and U3 -> SHOULD be 0
SET test.uid='22222222-2222-2222-2222-222222222222'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM messages WHERE id='dddddddd-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('uvedkommende laeser privat DM', :c, 0);

-- EJER reads own event guest_checkins (report path) -> SHOULD be 1
SET test.uid='11111111-1111-1111-1111-111111111111'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM guest_checkins WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('[kontrol] EJER laeser guests (rapport)', :c, 1);

-- ADMIN reads guest_checkins (scanner lookup) -> SHOULD be 1
SET test.uid='44444444-4444-4444-4444-444444444444'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM guest_checkins WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('[kontrol] ADMIN laeser guests (scanner)', :c, 1);

-- uninvolved U3 reads ALL guest_checkins (PII: name+title) -> SHOULD be 0
SET test.uid='33333333-3333-3333-3333-333333333333'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM guest_checkins \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('uvedkommende laeser guests (PII)', :c, 0);

-- ── SCANNER WRITES (checked_in_at) — reset to NULL between actors as superuser ──
-- EJER marks guest checked in -> SHOULD succeed
SET test.uid='11111111-1111-1111-1111-111111111111'; SET test.role='authenticated'; SET ROLE authenticated;
UPDATE guest_checkins SET checked_in_at=now() WHERE id='eeeeeeee-0000-0000-0000-000000000001';
RESET ROLE;
SELECT (checked_in_at IS NOT NULL)::int AS c FROM guest_checkins WHERE id='eeeeeeee-0000-0000-0000-000000000001' \gset
INSERT INTO _r(name,got,want) VALUES ('[kontrol] EJER scanner check-in', :c, 1);
UPDATE guest_checkins SET checked_in_at=NULL WHERE id='eeeeeeee-0000-0000-0000-000000000001';

-- ADMIN marks guest checked in -> SHOULD succeed
SET test.uid='44444444-4444-4444-4444-444444444444'; SET test.role='authenticated'; SET ROLE authenticated;
UPDATE guest_checkins SET checked_in_at=now() WHERE id='eeeeeeee-0000-0000-0000-000000000001';
RESET ROLE;
SELECT (checked_in_at IS NOT NULL)::int AS c FROM guest_checkins WHERE id='eeeeeeee-0000-0000-0000-000000000001' \gset
INSERT INTO _r(name,got,want) VALUES ('[kontrol] ADMIN scanner check-in', :c, 1);
UPDATE guest_checkins SET checked_in_at=NULL WHERE id='eeeeeeee-0000-0000-0000-000000000001';

-- uninvolved U3 tries to mark guest checked in -> SHOULD be blocked (stays NULL)
SET test.uid='33333333-3333-3333-3333-333333333333'; SET test.role='authenticated'; SET ROLE authenticated;
UPDATE guest_checkins SET checked_in_at=now() WHERE id='eeeeeeee-0000-0000-0000-000000000001';
RESET ROLE;
SELECT (checked_in_at IS NOT NULL)::int AS c FROM guest_checkins WHERE id='eeeeeeee-0000-0000-0000-000000000001' \gset
INSERT INTO _r(name,got,want) VALUES ('uvedkommende scanner check-in (integritet)', :c, 0);

\echo ''
\echo '=== RLS PRIVATLIVS + INTEGRITET (got vs forventet-sikker) ==='
SELECT name, got, want, CASE WHEN got=want THEN 'OK' ELSE '*** FUND ***' END AS status FROM _r ORDER BY ord;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _r WHERE got <> want;
  IF n = 0 THEN
    RAISE NOTICE 'alle RLS-forventninger holdt (privatliv + integritet, ejer + admin virker)';
  ELSE
    RAISE EXCEPTION '% RLS-FUND - se tabel ovenfor', n;
  END IF;
END $$;
