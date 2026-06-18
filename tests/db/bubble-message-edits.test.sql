\set ON_ERROR_STOP on
\set OWNER  '00000000-0000-0000-0000-000000000001'
\set MEMBER '00000000-0000-0000-0000-000000000002'
\set NONMEM '00000000-0000-0000-0000-000000000003'
\set M1     '00000000-0000-0000-0000-0000000000c1'
\set M2     '00000000-0000-0000-0000-0000000000c2'

-- ── 1. Medlem KAN laese historik for M1 (forventet 1) ──
SELECT set_config('test.uid', :'MEMBER', false);
SET ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.bubble_message_edits WHERE message_id='00000000-0000-0000-0000-0000000000c1';
  IF n=1 THEN RAISE NOTICE 'PASS 1: medlem laeser historik (n=%)',n;
  ELSE RAISE EXCEPTION 'FAIL 1: medlem forventede 1 fik %',n; END IF;
END $$;
RESET ROLE;

-- ── 2. Ikke-medlem KAN IKKE laese historik (forventet 0) ──
SELECT set_config('test.uid', :'NONMEM', false);
SET ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.bubble_message_edits WHERE message_id='00000000-0000-0000-0000-0000000000c1';
  IF n=0 THEN RAISE NOTICE 'PASS 2: ikke-medlem blokeret fra historik (n=%)',n;
  ELSE RAISE EXCEPTION 'FAIL 2: ikke-medlem laekkede historik (n=%)',n; END IF;
END $$;
RESET ROLE;

-- ── 3. Ejer KAN laese historik (forventet 1) ──
SELECT set_config('test.uid', :'OWNER', false);
SET ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.bubble_message_edits WHERE message_id='00000000-0000-0000-0000-0000000000c1';
  IF n=1 THEN RAISE NOTICE 'PASS 3: ejer laeser historik (n=%)',n;
  ELSE RAISE EXCEPTION 'FAIL 3: ejer forventede 1 fik %',n; END IF;
END $$;
RESET ROLE;

-- ── 4. Ikke-medlem KAN IKKE forfalske historik (INSERT blokeres) ──
SELECT set_config('test.uid', :'NONMEM', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bubble_message_edits(message_id,content)
      VALUES ('00000000-0000-0000-0000-0000000000c1','forfalsket');
    RAISE EXCEPTION 'FAIL 4: ikke-medlem kunne indsaette historik';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 4: ikke-medlem blokeret fra at skrive historik';
  END;
END $$;
RESET ROLE;

-- ── 5. Forfatter (member) KAN logge historik for EGEN besked M1 ──
SELECT set_config('test.uid', :'MEMBER', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bubble_message_edits(message_id,content)
      VALUES ('00000000-0000-0000-0000-0000000000c1','medlems egen edit');
    RAISE NOTICE 'PASS 5: forfatter kan logge historik for egen besked';
  EXCEPTION WHEN insufficient_privilege THEN RAISE EXCEPTION 'FAIL 5: forfatter blev blokeret fra egen besked';
  END;
END $$;
RESET ROLE;

-- ── 6. Medlem KAN IKKE forfalske historik paa ANDENS besked (M2 = ejers) ──
SELECT set_config('test.uid', :'MEMBER', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bubble_message_edits(message_id,content)
      VALUES ('00000000-0000-0000-0000-0000000000c2','medlem forfalsker ejers');
    RAISE EXCEPTION 'FAIL 6: medlem kunne forfalske historik paa andens besked';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 6: medlem blokeret fra andens besked';
  END;
END $$;
RESET ROLE;

-- ── 7. Ejer (ikke forfatter af M1) KAN IKKE logge historik for medlems besked ──
SELECT set_config('test.uid', :'OWNER', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bubble_message_edits(message_id,content)
      VALUES ('00000000-0000-0000-0000-0000000000c1','ejer roerer medlems historik');
    RAISE EXCEPTION 'FAIL 7: ejer kunne logge historik for andens besked';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 7: ejer blokeret fra andens besked (kun forfatter skriver)';
  END;
END $$;
RESET ROLE;

SELECT '════ ALLE 7 ASSERTIONS GROENNE ════' AS resultat;
