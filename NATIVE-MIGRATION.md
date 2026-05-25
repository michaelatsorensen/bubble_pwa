# Bubble — Native Migration Plan

> **Formål:** Roadmap for React Native + Expo migration (Q1 2027 target).
>
> **Hvornår tilføjes til denne fil?** Når et arkitektur-element har klar mapping til native ækvivalent, eller når en redesign-kandidat er specifik nok til at planlægge migration.
>
> **Status:** Oprettet maj 2026. Skeleton — populeres som flow-mapping skrider frem.

## Grundprincipper

### 1. Native = backend normalization pressure, ikke frontend reset

Native rewrite handler om at **stabilisere platform-contracts før vi skifter frontend**. Det er IKKE en "ren arkitektur reset" af alt.

### 2. Survivors vs Replacements

| Lag | Native strategi |
|---|---|
| Supabase backend (Postgres, Auth, Realtime, Storage) | **Survives** — samme DB, samme RLS, samme tables |
| Edge functions | **Survives** — Deno-baseret, platform-agnostisk |
| DB triggers + RLS | **Survives** men stabiliseres (contract enforcement før migration) |
| Frontend vanilla JS | **Replaced** — React Native + Expo + TypeScript |
| Service Worker (web push) | **Replaced** — Expo Notifications API (FCM + APNs) |
| Realtime subscriptions | **Adapter pattern** — same channels, new client wrapper |

### 3. Vi porter ikke kaos

Hvert område der er **🟡 inferred** eller har dokumenteret tech debt skal være **✅ verified** og **resolved** før native migration. Ellers porter vi gæld forward.

### 4. Beware "rewrite idealism"

Ikke alle current PWA patterns skal "fixes" før native. Diskriminator: skaber pattern **contract ambiguity**? Hvis ja → fix. Hvis nej → port as-is.

## Migration Phases

### Phase 0 — Platform Stabilization (NOW → Q4 2026)

Sker parallelt med pilot og forretningsudvikling. **Skal være færdig før Phase 1.**

Push-ownership er besluttet i **ADR-006 (ACCEPTED)**: backend trigger-only som canonical kilde. Implementering i gang:
- ✅ ADR-006 besluttet (trigger-only + observability-først princip)
- ✅ `push_events` observability-tabel + edge fn v2 **bygget** (migration klar, afventer deploy)
- ✅ Cross-user endpoint-bug fikset (eviction-trigger, ét endpoint = én bruger) — deployed maj 2026
- ⏳ Deploy push_events + edge v2 (på PC)
- ⏳ Reparér triggers: kobl `on_new_message_push` → `notify_new_message`, fix recipient_id→user_id, slet døde `trigger_push_on_*`
- ⏳ Verificér levering via push_events, fjern frontend `sendPush` for dækkede typer
- ⏳ Vault migration for secrets (supabase_vault 0.3.1 aktiveret, tom)
- ⏳ Q-062: GDPR-sletteprocedure for 5 NO ACTION-relationer

**Nøgle-migration (legacy JWT → sb_secret):** uafhængigt sikkerhedsspor. Vigtigt, men **gater IKKE native** — ændrer hvilke nøgler der bruges, ikke auth-*kontrakten* (Supabase Auth, session-model, RLS uændret). Kan foregå når som helst.

### Phase 1 — Vertical Slice (Q1 2027)

Bygge ét end-to-end flow i React Native og dokumentere migration-pattern.

**Kandidat:** Auth + Onboarding (mindst koblet til realtime/push complexity).

**Output:** Working React Native app med signup → login → home, deployed via TestFlight + Play Store internal track.

### Phase 2 — Core Flows (Q2 2027)

Migrate de 3 GOLD STANDARD flows fra Session 4 batch 1:

1. Bubble Join Flow
2. DM Send/Receive Flow
3. Live Check-in Flow

### Phase 3 — Feature Parity (H2 2027)

Resterende screens og features. PWA bliver "legacy support" mode.

### Phase 4 — PWA Sunset (2028+)

Beslutning om PWA fortsætter som lightweight fallback eller udfases helt.

---

## Mapping: Current PWA → Native equivalent

*Populeres som mapping skrider frem. Første kandidat: Push (fra ARCHITECTURE-MAP.md Section 19.7).*

### Push Notification Flow

| PWA | Native |
|---|---|
| `web-push` library (VAPID) | Firebase Cloud Messaging (Android) + Apple Push Notification Service (iOS) |
| `push_subscriptions` table (VAPID endpoint) | `push_tokens` table (FCM/APNs token) |
| Service Worker push event | Expo Notifications API |
| Service Worker notificationclick | `Linking` API deep-link routing |
| pg_net.http_post direct dispatch | Same — platform-agnostisk |

**Migration enabler:** Hvis `push_events` table (proposed redesign) implementeres i Phase 0, branch ind i FCM/APNs sker i edge function uden client-side ændringer.

### Auth Flow

| PWA | Native |
|---|---|
| Supabase Auth (email/password + OAuth) | **Survives** — samme `supabase-js` auth API |
| Session i `localStorage` (auto-persist) | Expo SecureStore som session-storage adapter |
| `sb.auth.onAuthStateChange` listener | **Survives** — samme API, men adapter til RN lifecycle |
| Deep-link auth (`?auth=1`, magic links) | Universal Links (iOS) + App Links (Android) + `Linking` API |

**Kontrakt uændret:** RLS-mønstret `auth.uid() = user_id` gælder uanset klient. Native arver præcis samme session-model. Nøgle-format (legacy vs sb_secret) er irrelevant for kontrakten.

### Realtime Subscriptions

| PWA | Native |
|---|---|
| `sb.channel().on('postgres_changes'/'broadcast')` | **Survives** — samme API |
| Channel lifecycle bundet til DOM-screen | Adapter: bind til RN navigation/screen-focus |
| `broadcast: { self: false }` (DM) | **Survives** — kritisk invariant, port direkte |
| Dedup på `data-msg-id` i DOM | **Replaced** — dedup mod store/state (ingen DOM i native) |

**Kritisk invariant der SKAL porteres:** own-echo-exclusion + id-baseret dedup (se Kontrakter §realtime). Uden begge får native dublet-beskeder.

---

## Kontrakter native arver (verificeret maj 2026)

> Dette er det native bygger MOD. Alle punkter er verificeret mod production, ikke inferred. Native skal ikke læse web-koden — den skal bygge mod disse kontrakter.

### Data-model (FK delete-regler verificeret)

Kerne-tabeller: `profiles`, `bubbles`, `bubble_members`, `messages` (DM), `bubble_messages`, `bubble_posts`, `bubble_message_reactions`, `saved_contacts`, `profile_views`, `qr_scans`, `guest_checkins`, `push_subscriptions`, `push_events`, `error_log`.

**`messages` (DM) kolonner:** id, sender_id, receiver_id, content (NOT NULL), file_url, file_name, file_size, file_type, **gif_url** (tilføjet maj 2026), read_at, edited, created_at.

**Sletning ved brugersletning (GDPR — verificeret):**
- CASCADE (rent): bubble_members, messages, profile_views, saved_contacts
- SET NULL: qr_scans
- **NO ACTION (blokerer sletning):** bubble_messages, bubble_message_reactions, bubble_posts, bubbles.created_by, guest_checkins.claimed_by → **Q-062 åben:** native arver denne blokering; sletteprocedure skal besluttes (anonymisér/slet/overdrag).

### dbActions write-lag (kontrakt)

Alle authoritative writes går (skal gå) via `dbActions` i b-utils.js. Native replikerer samme funktioner + return-kontrakt. Funktioner: `saveContact`, `removeContact`, `joinBubble`, `leaveBubble`, `updateProfile`, `sendDM`, `sendBubbleMessage`, `reportUser`.

**Return-kontrakt:** `{ ok: bool, data?/message?, error?, ... }`. `joinBubble` bruger discriminated union (ADR-005): `{ ok, status: 'joined_now'|'already_member', ... }` / `{ ok: false, status: 'failed', reason }`.

**⚠️ Ikke-konsekvent endnu (ADR-006 Fase 1):** DM-tekstsend skriver stadig direkte til Supabase i b-messages.js (3 stier) uden om dbActions.sendDM. Skal centraliseres før native porter DM. Kontrakten er målet; web er ikke helt der.

### RLS-model

**Princip:** `auth.uid() = user_id` på de fleste tabeller. **Privacy håndhæves client-side** (ikke i RLS) — fx joinBubble-source-param der bypasser privacy-gate for QR/invite. Native SKAL replikere den client-side privacy-logik (RLS alene beskytter ikke).

### Push-kontrakt (post-ADR-006)

**Canonical kilde:** backend DB-trigger (ikke frontend). Native arver dette gratis — insert en række, trigger fyrer push. Edge function `send-push` forventer `{ type, user_id, title, body, data, source }`, kræver `user_id`, slår op i `push_subscriptions`.

**Invariant: ét endpoint = én bruger.** Håndhævet af `trg_evict_stale_push_endpoint` (BEFORE INSERT). Native bruger samme tabel — invarianten holder uanset klient.

**Observability:** `push_events` (event_type, recipient_user_id, source, status, sent_count, error). Native push-leverancer logges samme sted.

### Realtime-kontrakt (dedup-invariant)

To lag der SKAL replikeres i native (ellers dubletter):
1. **Egne beskeder echoes aldrig tilbage:** DM via `broadcast: { self: false }` + postgres-filter `receiver_id = uid`; bubble via eksplicit `if user_id === currentUser return`.
2. **Indgående dedup på msg-id** (native: mod store, ikke DOM).
Reconnect: fuld refetch (ikke inkrementel) for at rydde forældet state.

---

## Risks & Open Questions

### Identified migration risks

1. **Realtime adapter complexity** — Supabase Realtime client har samme API men different lifecycle på React Native
2. **Deep-link routing** — Universal Links + Android App Links kræver setup som vi ikke har dokumenteret
3. **Offline-first patterns** — PWA bruger ingen offline-strategi; native vil presse til SQLite local cache
4. **State management** — Vanilla JS bruger module-level globals; native kræver explicit store (Zustand/Jotai)
5. **TypeScript migration** — Vanilla JS er typeløs; types skal udledes fra Supabase schema + flow contracts

### Cross-references

- Native arkitekturanalyse: ARCHITECTURE-MAP.md Section 19.7 (Push), TBD for andre flows
- Decisions: ARCHITECTURE-DECISIONS.md (når approved)
- Tech debt blokerere: TECH-DEBT.md med P1 prioritet

---

*Sidst opdateret: maj 2026 — kontrakter native arver tilføjet (verificeret mod production).*
