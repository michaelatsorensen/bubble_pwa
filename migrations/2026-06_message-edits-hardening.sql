-- 2026-06_message-edits-hardening.sql
-- Lukker bubble_message_edits. Redigerings-historikken holder den oprindelige
-- beskedtekst (message_id + content). To huller:
--   SELECT true  -> enhver kunne laese beskedindhold i ALLE bobler, ogsaa de
--                   private vi netop medlems-gatede paa bubble_messages.
--   INSERT true  -> enhver kunne forfalske historik for hvilken som helst besked.
-- Dette lukker det vi aabnede da bubble_messages blev medlems-gated -- samme
-- indhold, nabotabel.
--
-- Verificeret i replica foer deploy:
--   tests/db/run-bubble-message-edits-test.sh  (7/7 groenne; negativ kontrol
--   mod de gamle true-policies = roed, saa testen beviseligt fanger hullet).

BEGIN;

-- Fjern de vidaabne policies
DROP POLICY IF EXISTS bubble_message_edits_select ON public.bubble_message_edits;
DROP POLICY IF EXISTS bubble_message_edits_insert ON public.bubble_message_edits;

-- Laesning: kun medlemmer af boblen som beskeden hoerer til.
-- (membership-JOIN er den faktiske gate -- virker uanset bubble_messages egen RLS)
CREATE POLICY bubble_message_edits_member_read
  ON public.bubble_message_edits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bubble_messages m
    JOIN public.bubble_members mem ON mem.bubble_id = m.bubble_id
    WHERE m.id = bubble_message_edits.message_id
      AND mem.user_id = auth.uid()
  ));

-- Laesning: ejer af boblen (baelte+seler; ejer auto-joiner som medlem)
CREATE POLICY bubble_message_edits_owner_read
  ON public.bubble_message_edits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bubble_messages m
    JOIN public.bubbles b ON b.id = m.bubble_id
    WHERE m.id = bubble_message_edits.message_id
      AND b.created_by = auth.uid()
  ));

-- Skrivning: KUN forfatteren af beskeden maa logge dens historik
CREATE POLICY bubble_message_edits_author_insert
  ON public.bubble_message_edits FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bubble_messages m
    WHERE m.id = bubble_message_edits.message_id
      AND m.user_id = auth.uid()
  ));

COMMIT;

-- ── Verifikation (read-only). Forventet: 3 raekker, er_aaben = f paa alle. ──
SELECT policyname, cmd,
       (qual IS NOT DISTINCT FROM 'true' OR with_check IS NOT DISTINCT FROM 'true') AS er_aaben
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'bubble_message_edits'
ORDER BY cmd, policyname;
