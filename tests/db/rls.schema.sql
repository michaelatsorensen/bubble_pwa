-- RLS replica: runs as the real `authenticated` / `anon` roles (NOT superuser,
-- which bypasses RLS) to prove what a non-participant can actually read.
-- Policies below are the real production policies (from pg_policies), including
-- the redundant ones — because Postgres OR-combines permissive policies, so the
-- loosest wins, and that is exactly the effect we need to reproduce.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid()  RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.role', true),'') $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;

CREATE TABLE public.profiles       (id uuid PRIMARY KEY, name text, role text, banned boolean DEFAULT false);
CREATE TABLE public.bubbles        (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, created_by uuid, visibility text);
CREATE TABLE public.bubble_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, user_id uuid, role text DEFAULT 'member', status text);
CREATE TABLE public.bubble_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, user_id uuid, content text);
CREATE TABLE public.bubble_posts   (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, author_id uuid, content text);
CREATE TABLE public.messages       (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid, receiver_id uuid, content text);
CREATE TABLE public.guest_checkins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, guest_name text, guest_email text);

-- Supabase pattern: the api roles hold table privileges; RLS is the gate.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon;

ALTER TABLE public.bubble_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_checkins  ENABLE ROW LEVEL SECURITY;

-- membership is world-readable (needed by EXISTS subqueries below)
CREATE POLICY "Alle kan se medlemmer" ON public.bubble_members FOR SELECT TO public USING (true);

-- ── bubble_messages SELECT: all three real policies (OR-combined) ──
CREATE POLICY "Authenticated users can view bubble messages" ON public.bubble_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Medlemmer kan laese boble-beskeder" ON public.bubble_messages FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM bubble_members m WHERE m.bubble_id = bubble_messages.bubble_id AND m.user_id = auth.uid()));
CREATE POLICY "bubble_messages_select" ON public.bubble_messages FOR SELECT TO public USING (true);

-- ── bubble_posts SELECT: only the member-gated policy exists ──
CREATE POLICY "Members can read posts" ON public.bubble_posts FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM bubble_members m WHERE m.bubble_id = bubble_posts.bubble_id AND m.user_id = auth.uid()));

-- ── messages (DM) SELECT: sender/receiver only ──
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO public USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ── guest_checkins: anon read true; authenticated ALL true ──
CREATE POLICY "anon_read_guest" ON public.guest_checkins FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_guest"  ON public.guest_checkins FOR ALL    TO authenticated USING (true);
