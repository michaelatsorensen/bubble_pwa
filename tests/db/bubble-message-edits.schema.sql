-- Replica af det relevante udsnit: bobler, medlemmer, beskeder, redigerings-historik.
-- bubble_messages har den RETTEDE medlems-gate (som vi deployede i dag).
-- bubble_message_edits har de NYE policies vi tester.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid
$$;

CREATE TABLE public.bubbles (
  id uuid PRIMARY KEY,
  created_by uuid,
  visibility text DEFAULT 'public'
);
CREATE TABLE public.bubble_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bubble_id uuid REFERENCES public.bubbles(id),
  user_id uuid,
  role text DEFAULT 'member'
);
CREATE TABLE public.bubble_messages (
  id uuid PRIMARY KEY,
  bubble_id uuid REFERENCES public.bubbles(id),
  user_id uuid,
  content text,
  edited boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.bubble_message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.bubble_messages(id),
  content text,
  edited_at timestamptz DEFAULT now()
);

ALTER TABLE public.bubbles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_message_edits ENABLE ROW LEVEL SECURITY;

-- bubbles + members laeses bredt i prod i dag (Tier 2 ufikset) - mirror det
CREATE POLICY bubbles_read ON public.bubbles        FOR SELECT USING (true);
CREATE POLICY members_read ON public.bubble_members FOR SELECT USING (true);

-- bubble_messages: den RETTEDE medlems-gate fra i dag
CREATE POLICY bm_member_read ON public.bubble_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bubble_members mem
                 WHERE mem.bubble_id = bubble_messages.bubble_id
                   AND mem.user_id = auth.uid()));
CREATE POLICY bm_owner_read ON public.bubble_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bubbles b
                 WHERE b.id = bubble_messages.bubble_id
                   AND b.created_by = auth.uid()));

-- ════ FIXET UNDER TEST: bubble_message_edits ════
-- Laesning: kun medlemmer af boblen beskeden hoerer til (membership-JOIN er den
-- faktiske gate - virker uanset bubble_messages egen RLS)
CREATE POLICY bme_member_read ON public.bubble_message_edits FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bubble_messages m
                 JOIN public.bubble_members mem ON mem.bubble_id = m.bubble_id
                 WHERE m.id = bubble_message_edits.message_id
                   AND mem.user_id = auth.uid()));
-- Laesning: ejer af boblen (baelte+seler; ejer auto-joiner som medlem)
CREATE POLICY bme_owner_read ON public.bubble_message_edits FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bubble_messages m
                 JOIN public.bubbles b ON b.id = m.bubble_id
                 WHERE m.id = bubble_message_edits.message_id
                   AND b.created_by = auth.uid()));
-- Skrivning: KUN forfatteren af beskeden maa logge dens historik
CREATE POLICY bme_author_insert ON public.bubble_message_edits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.bubble_messages m
                      WHERE m.id = bubble_message_edits.message_id
                        AND m.user_id = auth.uid()));

-- Rolle der koeres SOM i testen (IKKE superuser - superuser bypasser RLS)
CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT ON public.bubbles, public.bubble_members, public.bubble_messages, public.bubble_message_edits TO authenticated;
GRANT INSERT ON public.bubble_message_edits TO authenticated;

-- ════ Seed ════
-- B ejes af owner; member er medlem; nonmem er IKKE
INSERT INTO public.bubbles (id, created_by, visibility) VALUES
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','private');
INSERT INTO public.bubble_members (bubble_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','admin'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','member');
-- M1 skrevet af member, M2 skrevet af owner
INSERT INTO public.bubble_messages (id, bubble_id, user_id, content) VALUES
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','medlems besked'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','ejer besked');
-- En historik-raekke for M1
INSERT INTO public.bubble_message_edits (id, message_id, content) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','original tekst');
