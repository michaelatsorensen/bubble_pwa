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

- ✅ Vault migration for secrets (TD-XXX)
- ✅ Push contract formalization (PushDispatchPayload v1)
- ✅ push_delivery_log for observability
- ⏳ Resolve recipient_id vs user_id mismatch
- ⏳ Single source of dispatch (deprecate `b-utils.js sendPush()`)
- ⏳ Resolve double-triggers on invitations
- ⏳ Verify all 🟡 inferred items i ARCHITECTURE-MAP.md
- ⏳ Map deep-link auth flow (Session 4 batch 2 part 2)
- ⏳ Map remaining flows (Phase B sessions 5-12)

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

*TBD efter deep-link auth flow er mappet.*

### Realtime Subscriptions

*TBD efter realtime audit.*

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

*Sidst opdateret: 18. maj 2026*
