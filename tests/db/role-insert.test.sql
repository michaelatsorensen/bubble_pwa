\set ON_ERROR_STOP on
-- O=owner, A=attacker (regular user), G=a guest the owner checks in
INSERT INTO public.profiles(id,name) VALUES
 ('11111111-1111-1111-1111-111111111111','Owner'),
 ('22222222-2222-2222-2222-222222222222','Attacker'),
 ('33333333-3333-3333-3333-333333333333','Guest');
INSERT INTO public.bubbles(id,name,created_by,visibility) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','PublicBubble','11111111-1111-1111-1111-111111111111','public');

CREATE TEMP TABLE _r (ord serial, name text, got text, want text);

-- ATTACK: regular user A inserts THEMSELVES as admin
SET test.uid='22222222-2222-2222-2222-222222222222'; SET ROLE authenticated;
INSERT INTO bubble_members(bubble_id,user_id,role) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','admin');
RESET ROLE;
SELECT COALESCE((SELECT role FROM bubble_members WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id='22222222-2222-2222-2222-222222222222'),'<ingen raekke>') AS c \gset
INSERT INTO _r(name,got,want) VALUES ('almindelig bruger indsaetter sig selv som ADMIN', :'c', 'member');

-- CONTROL: owner checks in a guest as member -> should succeed
SET test.uid='11111111-1111-1111-1111-111111111111'; SET ROLE authenticated;
INSERT INTO bubble_members(bubble_id,user_id,role) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','member');
RESET ROLE;
SELECT COALESCE((SELECT role FROM bubble_members WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id='33333333-3333-3333-3333-333333333333'),'<ingen raekke>') AS c \gset
INSERT INTO _r(name,got,want) VALUES ('[kontrol] ejer checker gaest ind (member)', :'c', 'member');

-- CONTROL: attacker tries to insert a row for ANOTHER user -> should be blocked (no row)
SET test.uid='22222222-2222-2222-2222-222222222222'; SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO bubble_members(bubble_id,user_id,role) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','member');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; -- RLS denial is expected
  END;
END $$;
RESET ROLE;
-- count rows for G inserted by anyone besides the owner's legit one above: there should be exactly 1 (the owner's)
SELECT count(*)::text AS c FROM bubble_members WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id='33333333-3333-3333-3333-333333333333' \gset
INSERT INTO _r(name,got,want) VALUES ('[kontrol] angriber kan IKKE indsaette for andre', :'c', '1');

-- CONTROL: owner CAN create an admin (owner privilege preserved)
SET test.uid='11111111-1111-1111-1111-111111111111'; SET ROLE authenticated;
INSERT INTO bubble_members(bubble_id,user_id,role) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin');
RESET ROLE;
SELECT COALESCE((SELECT role FROM bubble_members WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id='11111111-1111-1111-1111-111111111111'),'<ingen>') AS c \gset
INSERT INTO _r(name,got,want) VALUES ('[kontrol] ejer kan oprette en admin', :'c', 'admin');

\echo ''
\echo '=== bubble_members INSERT-autorisation (got vs forventet-sikker) ==='
SELECT name, got, want, CASE WHEN got=want THEN 'OK' ELSE '*** FUND ***' END AS status FROM _r ORDER BY ord;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _r WHERE got <> want;
  IF n = 0 THEN RAISE NOTICE 'INSERT-autorisation ok';
  ELSE RAISE EXCEPTION '% INSERT-FUND - se tabel ovenfor', n; END IF;
END $$;
