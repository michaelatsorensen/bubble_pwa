# Bubble — Auto-generated File Stats

> **AUTO-GENERATED** · Do not edit manually.  
> Generated: 2026-05-09 20:59:52 UTC · Commit: `8efed76` · Branch: `main`  
> Generator: `scripts/extract-arch-stats.sh`

## 📜 Rule for this document

> **This file contains only mechanically extractable facts.**  
> **If a section requires interpretation, it belongs in `ARCHITECTURE-MAP.md` instead.**

This document is mechanically extracted from the codebase on every push.
It contains only objectively verifiable data — no interpretations, no
assumptions, no semantic analysis.

For semantic architecture documentation, see:
- `ARCHITECTURE-MAP.md` (foundation map, manually maintained)
- `ARCHITECTURE-LOG.md` (architecture decisions, manually maintained)
- `STRATEGI.md` (product strategy, manually maintained)
- `OPEN-QUESTIONS.md` (open arch questions, manually maintained)

---

## 1. File Inventory

### 1.1 Production (root)

| File | Lines | Size (bytes) | Last modified |
|---|---:|---:|---|
| `ARCHITECTURE-LOG.md` | 336 | 12432 | 2026-05-09 |
| `ARCHITECTURE-MAP.md` | 1351 | 59771 | 2026-05-09 |
| `OPEN-QUESTIONS.md` | 188 | 7479 | 2026-05-09 |
| `STRATEGI.md` | 551 | 21930 | 2026-05-09 |
| `app.css` | 2294 | 134010 | 2026-05-08 |
| `b-admin.js` | 690 | 36291 | 2026-04-15 |
| `b-auth.js` | 788 | 42120 | 2026-04-28 |
| `b-boot.js` | 975 | 43525 | 2026-05-03 |
| `b-bubbles.js` | 2340 | 119588 | 2026-05-03 |
| `b-chat.js` | 2455 | 133382 | 2026-05-03 |
| `b-config.js` | 415 | 18205 | 2026-05-08 |
| `b-home.js` | 2452 | 132090 | 2026-05-03 |
| `b-i18n.js` | 1318 | 52478 | 2026-05-03 |
| `b-live.js` | 1189 | 55205 | 2026-04-15 |
| `b-messages.js` | 355 | 15068 | 2026-04-28 |
| `b-navigation.js` | 358 | 13720 | 2026-04-15 |
| `b-notifications.js` | 669 | 32971 | 2026-04-28 |
| `b-onboarding.js` | 1127 | 72635 | 2026-04-17 |
| `b-profile.js` | 1667 | 83917 | 2026-04-28 |
| `b-radar.js` | 490 | 28985 | 2026-04-07 |
| `b-realtime.js` | 1285 | 59477 | 2026-05-03 |
| `b-utils.js` | 1139 | 57122 | 2026-05-03 |
| `bubble-icons.js` | 68 | 10217 | 2026-04-01 |
| `index.html` | 1800 | 149908 | 2026-05-08 |
| `landing.html` | 1024 | 54995 | 2026-04-03 |
| `manifest.json` | 32 | 695 | 2026-03-31 |
| `sw.js` | 132 | 4552 | 2026-05-08 |
| `tag-data.js` | 240 | 10522 | 2026-03-15 |
| `test-signup-flows.html` | 198 | 12706 | 2026-04-17 |

### 1.2 Next branch (next/)

| File | Lines | Size (bytes) | Last modified |
|---|---:|---:|---|
| `next/DESIGN-GUIDE.md` | 397 | 10411 | 2026-04-15 |
| `next/DESIGN-SYSTEM.md` | 224 | 9474 | 2026-05-03 |
| `next/app.css` | 3931 | 194805 | 2026-05-08 |
| `next/b-admin.js` | 690 | 36420 | 2026-04-13 |
| `next/b-auth.js` | 785 | 42105 | 2026-04-28 |
| `next/b-boot.js` | 975 | 43522 | 2026-05-03 |
| `next/b-bubbles.js` | 2340 | 119698 | 2026-05-03 |
| `next/b-chat.js` | 2466 | 132911 | 2026-05-03 |
| `next/b-config.js` | 414 | 18206 | 2026-05-08 |
| `next/b-home.js` | 2510 | 131954 | 2026-05-03 |
| `next/b-i18n.js` | 1336 | 52969 | 2026-05-03 |
| `next/b-live.js` | 1189 | 55462 | 2026-04-27 |
| `next/b-messages.js` | 365 | 15634 | 2026-05-01 |
| `next/b-navigation.js` | 374 | 14412 | 2026-04-12 |
| `next/b-notifications.js` | 687 | 33713 | 2026-04-28 |
| `next/b-onboarding.js` | 1128 | 73118 | 2026-04-27 |
| `next/b-profile.js` | 1667 | 84479 | 2026-04-28 |
| `next/b-radar.js` | 496 | 29682 | 2026-04-27 |
| `next/b-realtime.js` | 1288 | 59701 | 2026-05-03 |
| `next/b-utils.js` | 1167 | 57918 | 2026-05-03 |
| `next/bubble-icons.js` | 68 | 10217 | 2026-04-12 |
| `next/bubble-smoke-tests-v5.html` | 928 | 50761 | 2026-04-15 |
| `next/index.html` | 1831 | 157876 | 2026-05-08 |
| `next/landing.html` | 1024 | 54995 | 2026-04-12 |
| `next/manifest.json` | 32 | 695 | 2026-04-12 |
| `next/sw.js` | 132 | 4554 | 2026-05-08 |
| `next/tag-data.js` | 240 | 10522 | 2026-04-12 |

### 1.3 Totals

| Metric | Value |
|---|---:|
| Prod JS lines | 20152 |
| Next JS lines | 20317 |

---

## 2. Function Counts per File

Detected via: `^function ` and `^async function ` declarations at top level.

### 2.1 Production

| File | Functions |
|---|---:|
| `b-admin.js` | 29 |
| `b-auth.js` | 30 |
| `b-boot.js` | 23 |
| `b-bubbles.js` | 57 |
| `b-chat.js` | 68 |
| `b-config.js` | 14 |
| `b-home.js` | 85 |
| `b-i18n.js` | 5 |
| `b-live.js` | 29 |
| `b-messages.js` | 15 |
| `b-navigation.js` | 11 |
| `b-notifications.js` | 25 |
| `b-onboarding.js` | 52 |
| `b-profile.js` | 68 |
| `b-radar.js` | 16 |
| `b-realtime.js` | 38 |
| `b-utils.js` | 47 |
| `bubble-icons.js` | 2 |
| `sw.js` | 0
0 |
| `tag-data.js` | 3 |

---

## 3. Script Load Order

From `index.html` script tags (production):

```
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js
bubble-icons.js?v=81726
tag-data.js?v=81726
b-i18n.js?v=81726
b-config.js?v=81726
b-utils.js?v=81726
b-auth.js?v=81726
b-home.js?v=81726
b-bubbles.js?v=81726
b-profile.js?v=81726
b-radar.js?v=81726
b-messages.js?v=81726
b-realtime.js?v=81726
b-onboarding.js?v=81726
b-chat.js?v=81726
b-notifications.js?v=81726
b-live.js?v=81726
b-admin.js?v=81726
b-navigation.js?v=81726
b-boot.js?v=81726
```

---

## 4. Supabase Table References

Tables referenced in code via `.from('table_name')`:

| Table | Files using |
|---|---|
| `analytics` | b-admin.js,b-boot.js |
| `blocked_users` | b-profile.js |
| `bubble_invitations` | b-bubbles.js,b-home.js,b-notifications.js,b-profile.js,b-utils.js |
| `bubble_members` | b-admin.js,b-boot.js,b-bubbles.js,b-chat.js,b-home.js,b-live.js,b-notifications.js,b-profile.js,b-radar.js,b-utils.js |
| `bubble_message_edits` | b-chat.js |
| `bubble_message_reactions` | b-chat.js |
| `bubble_messages` | b-admin.js,b-bubbles.js,b-chat.js,b-utils.js |
| `bubble_post_reactions` | b-chat.js,b-utils.js |
| `bubble_posts` | b-chat.js,b-utils.js |
| `bubble_upvotes` | b-bubbles.js |
| `bubbles` | b-admin.js,b-boot.js,b-bubbles.js,b-chat.js,b-home.js,b-live.js,b-notifications.js,b-profile.js,b-radar.js,b-realtime.js,b-utils.js |
| `custom_tags` | b-onboarding.js |
| `error_log` | b-admin.js,b-config.js |
| `guest_checkins` | b-bubbles.js,b-live.js |
| `messages` | b-admin.js,b-messages.js,b-notifications.js,b-realtime.js,b-utils.js |
| `profile_views` | b-admin.js,b-bubbles.js,b-profile.js |
| `profiles` | b-admin.js,b-auth.js,b-boot.js,b-bubbles.js,b-chat.js,b-home.js,b-live.js,b-notifications.js,b-onboarding.js,b-profile.js,b-radar.js,b-realtime.js,b-utils.js |
| `push_subscriptions` | b-auth.js,b-notifications.js |
| `qr_scans` | b-live.js |
| `qr_tokens` | b-admin.js,b-auth.js,b-boot.js,b-live.js,b-utils.js |
| `reports` | b-admin.js,b-auth.js,b-profile.js,b-utils.js |
| `saved_contacts` | b-admin.js,b-boot.js,b-bubbles.js,b-home.js,b-notifications.js,b-profile.js,b-radar.js,b-utils.js |

---

## 5. Browser Storage Keys

### 5.1 localStorage keys

Detected via `localStorage.setItem` / `localStorage.getItem` calls:

```
bubble_hs_prefs
bubble_lang
bubble_notifs_seen
bubble_selected_interests
bubble_stars
bubble_welcome_card_dismissed
bubble_welcomed
```

### 5.2 sessionStorage keys

Detected via `sessionStorage.setItem` / `sessionStorage.getItem` calls:

```
bb_route
bubble_came_from_landing
event_greeting
event_greeting_id
```

---

## 6. Realtime Channels

Channels created via `sb.channel(...)`:

```
admin-debug-errors
bc-
checkin-notify-
dm-notify-
member-notify-
rt-bubble-msgs-
rt-bubbles-deleted-
rt-invites-
rt-live-bubble-
rt-members-
rt-messages-
rt-saved-
```

---

## 7. Direct Database Writes

Calls to `.insert()`, `.update()`, `.upsert()`, `.delete()` per file.

These should ideally go through `dbActions` write-layer.
Files with high counts are migration candidates.

| File | insert | update | upsert | delete | Total |
|---|---:|---:|---:|---:|---:|
| `b-admin.js` | 0 | 2 | 0 | 0 | 2 |
| `b-auth.js` | 2 | 1 | 2 | 2 | 7 |
| `b-boot.js` | 1 | 1 | 0 | 2 | 4 |
| `b-bubbles.js` | 3 | 1 | 0 | 10 | 14 |
| `b-chat.js` | 2 | 5 | 0 | 4 | 11 |
| `b-config.js` | 1 | 0 | 0 | 0 | 1 |
| `b-home.js` | 0 | 5 | 0 | 0 | 5 |
| `b-live.js` | 1 | 1 | 0 | 0 | 2 |
| `b-messages.js` | 3 | 1 | 0 | 2 | 6 |
| `b-notifications.js` | 0 | 1 | 1 | 2 | 4 |
| `b-onboarding.js` | 1 | 8 | 2 | 3 | 14 |
| `b-profile.js` | 6 | 2 | 2 | 2 | 12 |
| `b-realtime.js` | 0 | 2 | 0 | 1 | 3 |
| `b-utils.js` | 12 | 8 | 3 | 5 | 28 |
| `sw.js` | 0 | 0 | 0 | 1 | 1 |

---

## 8. Edge Function Calls

Edge functions invoked from frontend code:

```
/functions/v1/checkin
/functions/v1/reset-test-user
send-push
```

---

## 9. Foundation Function Usage (Top Callees)

How many files call each foundation function:

| Function | Files using |
|---|---:|
| `logError` | 13 |
| `showToast` | 13 |
| `escHtml` | 12 |
| `goTo` | 8 |
| `appMode.` | 4 |
| `navState.` | 6 |
| `flowGet` | 4 |
| `flowSet` | 5 |
| `consumeFlow` | 3 |
| `isUuid` | 1 |
| `registerState` | 1 |
| `resetAppState` | 1 |
| `dbActions.` | 8 |
| `t(` | 14 |
| `translateStaticUI` | 1 |

---

## 10. TODO / FIXME / HACK Comments

Tracking technical debt comments in codebase:

**Total: 0 comments**

| Type | Count |
|---|---:|
| TODO | 0 |
| FIXME | 0 |
| HACK | 0 |
| XXX | 0 |

---

## 11. RPC Calls

Postgres RPC functions invoked via `sb.rpc('function_name')`:

| RPC Function | Files using |
|---|---|
| `count_new_unique_members` | b-chat.js |
| `count_unique_members` | b-chat.js |
| `get_latest_bubble_msg_times` | b-home.js |

---

## 12. Storage Usage

Supabase Storage buckets accessed via `sb.storage.from('bucket')`:

### 12.1 Buckets used

| Bucket | Files using |
|---|---|
| `bubble-files` | b-auth.js,b-bubbles.js,b-chat.js,b-messages.js,b-onboarding.js |

### 12.2 Storage operations per file

Only counts methods called **on storage buckets** (e.g.,
`sb.storage.from(...).upload()`). Excludes generic `.remove()`
on arrays/elements.

| File | upload | download | createSignedUrl | getPublicUrl |
|---|---:|---:|---:|---:|
| `b-auth.js` | 1 | 0 | 0 | 1 |
| `b-bubbles.js` | 1 | 0 | 0 | 1 |
| `b-chat.js` | 1 | 0 | 0 | 1 |
| `b-messages.js` | 1 | 0 | 0 | 1 |
| `b-onboarding.js` | 1 | 0 | 0 | 1 |

---

## 13. Auth Mutations

State-changing auth calls (`sb.auth.X(...)`). Read-only calls like
`getUser()` and `getSession()` are excluded — only mutations.

| Auth method | Files using |
|---|---|
| `signInWithPassword` | b-auth.js |
| `signUp` | b-auth.js |
| `signOut` | b-admin.js,b-auth.js,b-onboarding.js |
| `signInWithOAuth` | b-auth.js |
| `resetPasswordForEmail` | b-auth.js |

### 13.1 onAuthStateChange listeners

Files registering auth state change listeners:

```
b-auth.js
```

---

## 14. DOM Event Contracts

Inline HTML event handlers. These are implicit contracts between HTML and JS —
if the JS function is renamed, the HTML breaks silently.

For native (React Native), every inline handler must be replaced with a
prop-based handler (`onPress={...}`).

### 14.1 Inline event handlers in index.html

| Event type | Count |
|---|---:|
| `onclick="..."` | 202 |
| `onchange="..."` | 4 |
| `onkeydown="..."` | 3 |
| `oninput="..."` | 8 |
| `onfocus="..."` | 2 |

### 14.2 Inline event handlers in landing.html

| Event type | Count |
|---|---:|
| `onclick="..."` | 8 |

### 14.3 Top function names called from inline onclick

(Only names with `()` immediately after — most reliable)

| Function | Calls in HTML |
|---|---:|
| `if()` | 16 |
| `setupGoToStep()` | 15 |
| `closeModal()` | 9 |
| `pickSetupLifestage()` | 8 |
| `goTo()` | 8 |
| `spFilter()` | 5 |
| `filterRadarHome()` | 5 |
| `skipSetupSheet()` | 4 |
| `navBack()` | 4 |
| `closeChatMenu()` | 4 |
| `bcSwitchTab()` | 4 |
| `bbClose()` | 4 |
| `welcomeGo()` | 3 |
| `psClose()` | 3 |
| `profSwitchTab()` | 3 |
| `hsToggle()` | 3 |
| `closeRadarPerson()` | 3 |
| `closeLiveCheckoutTray()` | 3 |
| `addChipFromBtn()` | 3 |
| `viewAvatarFull()` | 2 |

---

## 15. Per-Table Write Locations

For each Supabase table, which files perform writes (insert/update/upsert/delete).

This is the most important section for native rewrite — it shows where
business logic for each entity lives. Tables written from many files are
candidates for **service-layer extraction** (e.g., `ProfileService`,
`BubbleService`).

| Table | Insert | Update | Upsert | Delete | Write-spread |
|---|---|---|---|---|---:|
| `analytics` | b-boot.js | _—_ | _—_ | _—_ | 1 |
| `blocked_users` | _—_ | _—_ | b-profile.js | _—_ | 1 |
| `bubble_invitations` | b-profile.js, b-utils.js | b-utils.js | _—_ | b-bubbles.js | 3 |
| `bubble_members` | b-bubbles.js, b-profile.js, b-utils.js | b-boot.js, b-bubbles.js, b-chat.js, b-notifications.js, b-utils.js | b-utils.js | b-boot.js, b-bubbles.js, b-chat.js, b-notifications.js, b-utils.js | 6 |
| `bubble_message_edits` | b-chat.js | _—_ | _—_ | _—_ | 1 |
| `bubble_message_reactions` | b-chat.js | _—_ | _—_ | b-chat.js | 1 |
| `bubble_messages` | b-utils.js | b-chat.js | _—_ | b-bubbles.js, b-utils.js | 3 |
| `bubble_post_reactions` | b-utils.js | _—_ | _—_ | b-utils.js | 1 |
| `bubble_posts` | b-utils.js | _—_ | _—_ | b-utils.js | 1 |
| `bubble_upvotes` | b-bubbles.js | _—_ | _—_ | b-bubbles.js | 1 |
| `bubbles` | b-bubbles.js, b-profile.js, b-utils.js | b-utils.js | _—_ | b-bubbles.js | 3 |
| `custom_tags` | b-onboarding.js | b-onboarding.js | _—_ | _—_ | 1 |
| `error_log` | b-config.js | _—_ | _—_ | _—_ | 1 |
| `guest_checkins` | _—_ | b-live.js | _—_ | _—_ | 1 |
| `messages` | b-messages.js, b-utils.js | b-messages.js, b-realtime.js | _—_ | b-messages.js, b-realtime.js, b-utils.js | 3 |
| `profile_views` | b-profile.js | _—_ | _—_ | _—_ | 1 |
| `profiles` | _—_ | b-admin.js, b-auth.js, b-home.js, b-onboarding.js, b-profile.js, b-utils.js | b-auth.js, b-onboarding.js, b-profile.js | b-auth.js, b-onboarding.js | 6 |
| `push_subscriptions` | _—_ | _—_ | b-notifications.js | b-auth.js, b-notifications.js | 2 |
| `qr_scans` | b-live.js | _—_ | _—_ | _—_ | 1 |
| `qr_tokens` | b-auth.js, b-utils.js | _—_ | _—_ | _—_ | 2 |
| `reports` | b-auth.js, b-profile.js, b-utils.js | _—_ | _—_ | _—_ | 3 |
| `saved_contacts` | _—_ | _—_ | b-utils.js | b-profile.js, b-utils.js | 2 |

**Migration priority:** Tables with high write-spread (4+ files) are
top candidates for service-layer extraction in native rewrite.


---

## Generation Info

- Script: `scripts/extract-arch-stats.sh`
- Workflow: `.github/workflows/arch-stats.yml`
- Generated: 2026-05-09 20:59:52 UTC
- Commit: `8efed76`
- Branch: `main`

To regenerate locally:
```bash
bash scripts/extract-arch-stats.sh
```

To extend this script, add a new section in `scripts/extract-arch-stats.sh`
and follow the existing pattern. Keep all extractions **mechanical** — no
human interpretations or assumptions.
