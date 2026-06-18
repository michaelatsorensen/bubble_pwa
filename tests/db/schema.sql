-- Faithful replica of the verified Bubble schema (FK rules + nullability as queried 18 June)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE ROLE authenticated;

-- auth.users (minimal) + auth.uid() simulating service-role context (NULL)
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

-- profiles: id FK -> auth.users ON DELETE CASCADE
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text, bio text, workplace text, title text, avatar_url text, linkedin text,
  keywords text[], dynamic_keywords text[], interests text[], sectors text[],
  life_phase text, lifestage text, role text, match_sector text
);

-- ── CONTENT (verified nullability) ──
CREATE TABLE public.bubbles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text,
  created_by uuid REFERENCES public.profiles(id),                       -- NULL ok, NO ACTION
  pending_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE TABLE public.bubble_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, content text,
  user_id uuid REFERENCES public.profiles(id)                           -- NULL ok, NO ACTION
);
CREATE TABLE public.bubble_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, content text,
  author_id uuid NOT NULL REFERENCES public.profiles(id)                -- NOT NULL (to test the ALTER)
);
CREATE TABLE public.guest_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimed_by uuid REFERENCES public.profiles(id)                        -- NULL ok, NO ACTION
);
CREATE TABLE public.bubble_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid, emoji text,
  user_id uuid REFERENCES public.profiles(id),                          -- NO ACTION
  UNIQUE (message_id, user_id)                                          -- collision risk if anonymized
);

-- ── CASCADE on profiles ──
CREATE TABLE public.bubble_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bubble_id uuid, role text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content text,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.saved_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ── auth.users referencing (the NO ACTION ones would BLOCK auth deletion) ──
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),                      -- NO ACTION, NOT NULL
  blocked_id uuid NOT NULL REFERENCES auth.users(id)                    -- NO ACTION, NOT NULL
);
CREATE TABLE public.custom_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text,
  created_by uuid REFERENCES auth.users(id)                             -- NO ACTION, nullable
);
CREATE TABLE public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), msg text,
  user_id uuid REFERENCES auth.users(id)                                -- NO ACTION, nullable
);
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id),                  -- NO ACTION, NOT NULL
  reported_id uuid REFERENCES auth.users(id)                            -- NO ACTION, nullable
);
CREATE TABLE public.bubble_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- storage.objects (both owner columns exist)
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text, name text, owner uuid, owner_id text
);
