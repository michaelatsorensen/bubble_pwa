-- ══════════════════════════════════════════════════════════
--  BUBBLE PUSH NOTIFICATIONS — SQL SETUP
--  Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- 2. Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  data jsonb,
  screen text,
  timestamp timestamptz DEFAULT now()
);
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own analytics" ON analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all analytics" ON analytics
  FOR SELECT USING (auth.uid() = '0015de9c-c128-477a-8110-2cbb38a625f4'::uuid);

-- 3. Database webhook function for new DMs
--    This calls the Edge Function when a new message is inserted
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger AS $$
DECLARE
  sender_name text;
  msg_preview text;
BEGIN
  -- Get sender name
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Build preview
  msg_preview := LEFT(COALESCE(NEW.content, 'Sendte et billede'), 50);

  -- Call Edge Function via pg_net (HTTP extension)
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'new_message',
      'user_id', NEW.receiver_id,
      'title', COALESCE(sender_name, 'Nogen') || ' sendte en besked',
      'body', msg_preview,
      'data', jsonb_build_object('sender_id', NEW.sender_id, 'type', 'dm')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger on messages table
DROP TRIGGER IF EXISTS on_new_message_push ON messages;
CREATE TRIGGER on_new_message_push
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- 5. Database webhook function for new saved contact
CREATE OR REPLACE FUNCTION notify_contact_saved()
RETURNS trigger AS $$
DECLARE
  saver_name text;
BEGIN
  SELECT name INTO saver_name FROM profiles WHERE id = NEW.user_id;

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'contact_saved',
      'user_id', NEW.contact_id,
      'title', COALESCE(saver_name, 'Nogen') || ' gemte din profil',
      'body', 'Tryk for at se hvem',
      'data', jsonb_build_object('saver_id', NEW.user_id, 'type', 'saved')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger on saved_contacts
DROP TRIGGER IF EXISTS on_contact_saved_push ON saved_contacts;
CREATE TRIGGER on_contact_saved_push
  AFTER INSERT ON saved_contacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_contact_saved();

-- 7. Database webhook for bubble invitations
CREATE OR REPLACE FUNCTION notify_bubble_invite()
RETURNS trigger AS $$
DECLARE
  sender_name text;
  bubble_name text;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.from_user_id;
  SELECT name INTO bubble_name FROM bubbles WHERE id = NEW.bubble_id;

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'bubble_invite',
      'user_id', NEW.to_user_id,
      'title', 'Invitation til ' || COALESCE(bubble_name, 'en boble'),
      'body', COALESCE(sender_name, 'Nogen') || ' inviterer dig',
      'data', jsonb_build_object('bubble_id', NEW.bubble_id, 'type', 'invite')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger on bubble_invitations
DROP TRIGGER IF EXISTS on_bubble_invite_push ON bubble_invitations;
CREATE TRIGGER on_bubble_invite_push
  AFTER INSERT ON bubble_invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_bubble_invite();

-- ══════════════════════════════════════════════════════════
--  VIGTIGT: pg_net extension skal være aktiveret
--  Gå til Supabase Dashboard > Database > Extensions
--  Søg "pg_net" og aktiver den
-- ══════════════════════════════════════════════════════════
