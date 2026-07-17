-- ─────────────────────────────────────────────────────────────────────
-- bubble-private storage bucket — chat + DM file access policies
-- STATUS: APPLIED LIVE via Supabase SQL editor, 17. juli 2026 (v3.146).
--         This file documents what is already running in production —
--         written retroactively so the repo does not lie about backend
--         state (see external review, 17. juli 2026: policies were
--         missing from the delivered package).
--
-- Bucket 'bubble-private' (Public: OFF) was created manually in the
-- Supabase dashboard the same day. These four policies are the only
-- access control on it. Two path namespaces:
--   chat/{bubbleId}/{timestamp}-{filename}  — boble-chat vedhaeftninger
--   dm/{userId}/{timestamp}-{filename}      — DM vedhaeftninger
--
-- Frontend reads via createSignedUrl (1 time), never getPublicUrl —
-- see resolvePrivateFileUrl() in b-utils.js. Uploads store the STORAGE
-- PATH in messages.file_url, not a public link.
--
-- Reversible: `drop policy "<name>" on storage.objects;` for each.
-- ─────────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1. Chat: upload kun for medlemmer af den paagaeldende boble ──
create policy "chat upload for bubble members"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bubble-private'
  and (storage.foldername(name))[1] = 'chat'
  and exists (
    select 1 from public.bubble_members bm
    where bm.bubble_id::text = (storage.foldername(name))[2]
      and bm.user_id = auth.uid()
  )
);

-- ── 2. Chat: laes kun for medlemmer af den paagaeldende boble ──
create policy "chat read for bubble members"
on storage.objects for select to authenticated
using (
  bucket_id = 'bubble-private'
  and (storage.foldername(name))[1] = 'chat'
  and exists (
    select 1 from public.bubble_members bm
    where bm.bubble_id::text = (storage.foldername(name))[2]
      and bm.user_id = auth.uid()
  )
);

-- ── 3. DM: upload kun til egen mappe (dm/{auth.uid()}/...) ──
create policy "dm upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bubble-private'
  and (storage.foldername(name))[1] = 'dm'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- ── 4. DM: laes kun for samtalens to parter (opslag i messages) ──
create policy "dm read for conversation parties"
on storage.objects for select to authenticated
using (
  bucket_id = 'bubble-private'
  and (storage.foldername(name))[1] = 'dm'
  and exists (
    select 1 from public.messages m
    where m.file_url = name
      and (m.sender_id = auth.uid() or m.receiver_id = auth.uid())
  )
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- KENDTE HULLER (fra eksternt review, 17. juli 2026 — IKKE lukket her):
--   - Et medlem der forlader/bliver banned fra en boble mister IKKE
--     automatisk laeseadgang til allerede-signede URLs foer de udloeber
--     (1 time), og policy'en gencheckes foerst ved naeste signed-URL-kald.
--   - Fejlet beskedinsert efter fil-upload rydder IKKE den uploadede fil
--     op igen (orphaned file i bubble-private).
--   - Kontosletning (GDPR) rydder p.t. KUN 'bubble-files', ikke
--     'bubble-private' — se b-profile.js ~964.
--   - Ingen pagination i evt. fremtidig storage-cleanup ud over 100
--     objekter (list() default-graense).
-- Disse er separate, afgraensede opgaver — parkeret, ikke glemt.
-- ─────────────────────────────────────────────────────────────────────
