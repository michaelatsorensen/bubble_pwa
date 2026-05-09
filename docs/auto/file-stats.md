# Bubble — Auto-generated File Stats

> **AUTO-GENERATED** · Do not edit manually.  
> Generated: 2026-05-09 16:52:12 UTC · Commit: `3c6de14` · Branch: `main`  
> Generator: `scripts/extract-arch-stats.sh`

This document is mechanically extracted from the codebase on every push.
It contains only objectively verifiable data — no interpretations.

For semantic architecture documentation, see:
- `ARCHITECTURE-MAP.md` (foundation map, manually maintained)
- `ARCHITECTURE-LOG.md` (architecture decisions, manually maintained)
- `STRATEGI.md` (product strategy, manually maintained)

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

## Generation Info

- Script: `scripts/extract-arch-stats.sh`
- Workflow: `.github/workflows/arch-stats.yml`
- Generated: 2026-05-09 16:52:12 UTC
- Commit: `3c6de14`
- Branch: `main`

To regenerate locally:
```bash
bash scripts/extract-arch-stats.sh
```

To extend this script, add a new section in `scripts/extract-arch-stats.sh`
and follow the existing pattern. Keep all extractions **mechanical** — no
human interpretations or assumptions.
