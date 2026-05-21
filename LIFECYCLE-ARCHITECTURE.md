# Bubble Native v1 — Lifecycle Architecture

> **Purpose:** Define how the app behaves across lifecycle events BEFORE code is written. Native lifecycle is fundamentally different from web — and is the biggest source of bugs in stateful apps.
>
> **Status:** SKELETON — to be filled in before native development kickoff
>
> **Anchored to:** ADR-007, Tenet 5 (Distill, don't port — esp. "lifecycle first, screens second")
>
> **Critical principle:** *"Bubble's biggest native risk is not 'build screens' — it's 'make state idiot-proof under chaotic lifecycle.'"*

## Why this document exists FIRST

Native apps live in a fundamentally different lifecycle than PWAs:

- OS can kill app process at any time
- Push notifications open cold-start scenarios
- Permissions change outside the app
- Network reconnects while app is sleeping
- Deeplinks arrive without context
- AppState transitions happen rapidly during use

Bubble is already realtime + stateful + flow-heavy. Native makes lifecycle the **dominant** concern, not UI.

This document defines our model BEFORE we write components. Otherwise we build screens that look correct but break under lifecycle stress.

## The 7 lifecycle models

### Model 1: AppState transitions

> *(TBD)*

**Questions to answer:**
- What happens on `active` → `background`?
- What happens on `background` → `active` (resume)?
- What happens on `inactive` (e.g., incoming call)?
- What state survives transitions vs. needs refresh?

**Decisions needed:**
- Do we suspend realtime subscriptions on background?
- Do we refresh data on resume?
- How long can app be backgrounded before full state refresh?

**Key concern from PWA learning:** We already know multi-tab consistency is hard (Q-058, Q-060). Native AppState is similar problem scaled up.

### Model 2: Restore model

> *(TBD)*

**Scenarios:**
- App killed by OS → user reopens → where do they land?
- App backgrounded for hours → resume → state stale?
- User force-closes → reopens → "where was I" expectation?

**Decisions needed:**
- Persistence layer (AsyncStorage? SecureStore? both?)
- What state is restored vs re-fetched?
- Restore timeout (try for X seconds, fall back to home)
- Conflict resolution (local state vs server state mismatch)

**Anti-pattern from PWA:** sessionStorage flow flags evolved-over-time. We MUST design this explicitly in native, not let it grow organically.

### Model 3: Deeplink model

> *(TBD)*

**Configuration needed:**
- Universal Links (iOS): `apple-app-site-association` file on server
- App Links (Android): `assetlinks.json` on server
- Custom URL scheme fallback: `bubble://`

**Scenarios:**
- User clicks invite link while app installed → opens app at right screen
- User clicks invite link without app → App Store + post-install resume
- User clicks link while app already open in different screen
- Push notification with deeplink while app killed

**Decisions needed:**
- Deeplink resolution priority
- Auth gating (link requires login → flow)
- Mid-onboarding handling (link arrives during signup)

**Direct learning from PWA Section 20:** All 4 entry paths from PWA must map to native equivalents. PWA's flow-flag system DOES NOT port — it's reinvented as explicit state machine.

### Model 4: Push navigation model

> *(TBD)*

**Critical scenarios:**
- Push received while app foregrounded
- Push received while app backgrounded
- Push tapped while app cold (process killed)
- Multiple pushes received while app off

**Decisions needed:**
- Push token registration timing (after login? before?)
- Notification permission flow (when ask, what fallback)
- Cold start routing (notification → which screen)
- Notification grouping (DMs from same person)
- Badge management (how badge count updates)

**Blocked on:** ADR-006 finalization (DM send + push strategy). Cannot design native push without knowing if frontend dispatches, DB triggers dispatch, or both.

### Model 5: Realtime reconnect model

> *(TBD)*

**Scenarios:**
- App backgrounded → returns → Supabase channels stale
- Network drops → reconnects → message queue?
- WiFi → cellular handoff
- Long idle (overnight) → resume

**Decisions needed:**
- Reconnect strategy (immediate, exponential backoff, max attempts)
- State refresh strategy (re-fetch all? diff-only?)
- User feedback (banner? toast? silent?)
- Channel re-subscription order (auth → user channels → bubble channels)

**Learning from PWA:** Already have `_rtState` machine with reconnect logic. Native version needs to be AppState-aware (don't try reconnect if backgrounded).

### Model 6: Offline assumptions

> *(TBD)*

**Decisions needed:**
- What works offline (read cached messages? read profile?)
- What's blocked offline (send DM? join bubble?)
- Offline UI patterns (banner? grayed-out actions?)
- Queue strategy for offline writes (or just block?)

**Honest assessment:** Bubble is realtime-first. Offline mode is probably "show cached read-only state + clear feedback that writes are blocked." Not full offline-first architecture.

### Model 7: Auth/session orchestration

> *(TBD)*

**Single source of truth questions:**
- Where does "am I logged in?" live? (Zustand store + Supabase session)
- What triggers logout flow? (Session expired, user action, security event)
- How does multi-device login behave? (Same user on iPhone + Android)
- How does token refresh work? (Supabase auto-refresh)

**Learning from PWA Q-058:** Multi-tab consistency was hard in PWA. Multi-device is similar — handle gracefully.

**Critical principle:** Session state has ONE owner (Zustand authStore). All other state derives from it. No spread session-checking across modules.

## Order of implementation

**Lifecycle FIRST, screens SECOND.** Suggested order:

1. **Foundation week 1-2:** AppState model + Auth orchestration
2. **Week 3:** Restore model
3. **Week 4:** Realtime reconnect
4. **Week 5:** Deeplink model
5. **Week 6:** Push navigation model
6. **Week 7+:** First screens built on solid lifecycle foundation

If we build screens first and lifecycle later, we re-do the screens.

## Anti-patterns to avoid

From PWA experience:

- **Multiple flow-state mechanisms** (sessionStorage + globals + DOM classes) → ONE mechanism (Zustand)
- **Auth orchestration spread across files** → ONE auth context
- **Implicit reconnect** (subscribe and hope) → EXPLICIT state machine
- **DOM-as-state** (data-msg-id attributes) → REACT state with reducers
- **Hacks evolved over time** (v8.17.16-20 redirect loop fixes) → DESIGNED from start

## Update process

When designing a new feature:

1. Check this document — what lifecycle scenarios apply?
2. If unclear: design lifecycle behavior before coding feature
3. If conflict with existing model: surface in ADR
4. Each model has owner — changes require explicit decision

---

*To be populated during pre-kickoff planning session (target: late juli 2026)*
