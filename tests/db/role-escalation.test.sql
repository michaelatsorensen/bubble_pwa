\set ON_ERROR_STOP on
-- O=owner, M=member, A=second admin, X=outsider, B=bubble
INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001'),
 ('aaaaaaaa-0000-0000-0000-000000000002'),
 ('aaaaaaaa-0000-0000-0000-000000000003'),
 ('aaaaaaaa-0000-0000-0000-000000000004');
INSERT INTO public.profiles(id,name) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','Owner'),
 ('aaaaaaaa-0000-0000-0000-000000000002','Member'),
 ('aaaaaaaa-0000-0000-0000-000000000003','Admin2'),
 ('aaaaaaaa-0000-0000-0000-000000000004','Outsider');
INSERT INTO public.bubbles(id,name,created_by) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','TestBubble','aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO public.bubble_members(bubble_id,user_id,role) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','admin'),
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','member'),
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','admin');

\echo '=== role-escalation guard scenarier ==='
DO $$
DECLARE
  O uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  M uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  A uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  X uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  B uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  r text; fails text := '';
BEGIN
  -- 1) OWNER promotes M -> admin (ALLOWED)
  UPDATE public._test_ctx SET uid = O;
  UPDATE bubble_members SET role='admin' WHERE bubble_id=B AND user_id=M;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=M;
  IF r IS DISTINCT FROM 'admin' THEN fails := fails||'[1 ejer kunne ikke forfremme] '; END IF;
  UPDATE bubble_members SET role='member' WHERE bubble_id=B AND user_id=M;  -- reset (still owner)

  -- 2) MEMBER self-escalation -> BLOCKED (role reverted)
  UPDATE public._test_ctx SET uid = M;
  UPDATE bubble_members SET role='admin' WHERE bubble_id=B AND user_id=M;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=M;
  IF r IS DISTINCT FROM 'member' THEN fails := fails||'[2 medlem selv-eskalerede!] '; END IF;

  -- 3) MEMBER tries to demote the OWNER -> BLOCKED
  UPDATE bubble_members SET role='member' WHERE bubble_id=B AND user_id=O;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=O;
  IF r IS DISTINCT FROM 'admin' THEN fails := fails||'[3 medlem aendrede ejer-rolle!] '; END IF;

  -- 4) OUTSIDER (not even a member) promotes M -> BLOCKED
  UPDATE public._test_ctx SET uid = X;
  UPDATE bubble_members SET role='admin' WHERE bubble_id=B AND user_id=M;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=M;
  IF r IS DISTINCT FROM 'member' THEN fails := fails||'[4 outsider eskalerede!] '; END IF;

  -- 5) NO auth context (uid NULL) -> BLOCKED (safe default)
  UPDATE public._test_ctx SET uid = NULL;
  UPDATE bubble_members SET role='admin' WHERE bubble_id=B AND user_id=M;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=M;
  IF r IS DISTINCT FROM 'member' THEN fails := fails||'[5 uden auth eskalerede!] '; END IF;

  -- 6) OWNER demotes A -> member (ALLOWED)
  UPDATE public._test_ctx SET uid = O;
  UPDATE bubble_members SET role='member' WHERE bubble_id=B AND user_id=A;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=A;
  IF r IS DISTINCT FROM 'member' THEN fails := fails||'[6 ejer kunne ikke degradere] '; END IF;

  -- 7) NON-owner updates own NON-role column -> ALLOWED, role untouched
  UPDATE public._test_ctx SET uid = M;
  UPDATE bubble_members SET last_active = now() WHERE bubble_id=B AND user_id=M;
  SELECT role INTO r FROM bubble_members WHERE bubble_id=B AND user_id=M;
  IF r IS DISTINCT FROM 'member' THEN fails := fails||'[7 ikke-rolle-update rorte rollen] '; END IF;
  IF NOT EXISTS (SELECT 1 FROM bubble_members WHERE bubble_id=B AND user_id=M AND last_active IS NOT NULL)
     THEN fails := fails||'[7b last_active blev ikke gemt] '; END IF;

  IF fails = '' THEN
    RAISE NOTICE '  OK  ALLE TJEK BESTAET - kun bubble-ejer kan aendre roller; ikke-ejere blokeret, ikke-rolle-writes uberorte';
  ELSE
    RAISE EXCEPTION '  FAIL: %', fails;
  END IF;
END $$;
