# PROD ↔ NEXT — Sync Log

> **Purpose:** Audit trail for every PROD↔NEXT sync action with directionality verification. Protects against reintroducing bugs or overwriting deliberate improvements.
>
> **Triggered by:** Michael's question (maj 2026): *"Når disse alignments bliver lavet, ser du så i historikken om rettelser den ene eller anden vej er til det bedre? Og undgår at genintroducere bugs?"*
>
> **Related:** PROD-NEXT-DRIFT.md (the catalog of what differs), LÆRING #8 (refactor reintroduces constants), Tenet 4 (grundighed over hastighed)

---

## Why this log exists

Git history revealed that PROD and NEXT have **cross-ported in both directions** historically (e.g. `next-v7.18 — backport v8.17.15 security`). This invalidates the naive assumption "PROD always wins." Each divergence must be evaluated on its own merits.

The risk: porting a fix that **overwrites a deliberate improvement** in the receiving codebase, or **reintroduces a bug** that was already fixed there under a different version number.

## Verification methodology

For **every** sync action, classify and verify:

### Step 1 — Classify type

- **ADDITIVE** — receiver had nothing; we add source's version
  - Low risk. Verify only that prerequisites exist (helper functions, variables)
- **REPLACEMENT** — we replace receiver's existing code with source's version
  - HIGH risk. Requires full directionality verification (Steps 2-4)

### Step 2 — Git provenance (replacements only)

- `git log -- <file>` on both sides → when did they diverge?
- Is the receiver version **newer**? It may contain an improvement
- Is there an ADR/LÆRING documenting which direction is correct?

### Step 3 — Logical test

- What does the new version do differently?
- Is the difference an improvement or a regression?
- Does porting break something the receiver needed?

### Step 4 — Preserve receiver-only work

- If NEXT has design features (e.g. auth hybrid screen), they MUST NOT be overwritten by a PROD port
- Confirm the port is surgical, not a blanket overwrite

---

## Sync session log

### Session 1 — maj 2026 — PROD hardening → NEXT (workstream 1)

**Context:** NEXT was missing all v8.17.31 Phase 1 reliability fixes + ADR-005 contract. Goal: bring NEXT's robustness up to PROD's level without overwriting NEXT's design v6 work.

**Git provenance finding:** PROD b-auth (v8.17.x) and NEXT b-auth (v7.x) evolved in parallel. NEXT has a unique `auth-merge (hybrid screen)` feature (v7.86/v7.93) that PROD does NOT have. Both already share the landing-redirect loop fix (PROD v8.17.19/20, NEXT v7.91/92). This confirmed: ports must be surgical.

---

#### Fix 1 — UUID validation in checkGuestEventRoute

- **File:** next/b-boot.js
- **Type:** ADDITIVE (NEXT had no validation)
- **Prerequisite check:** `isUuid()` exists in next/b-config.js ✅
- **Directionality:** N/A (additive — NEXT had nothing)
- **Logical test:** Adds security validation before `.or()` query. No existing behavior changed.
- **Risk:** NONE
- **Status:** ✅ Verified safe · committed `d7cbf0d`

#### ADR-005 — joinBubble discriminated union

- **File:** next/b-utils.js + 3 callers in next/b-home.js
- **Type:** REPLACEMENT (NEXT had deprecated `duplicate: true` pattern)
- **Directionality:** PROD wins — documented in LÆRING #7. The `duplicate` flag was removed in v8.17.29 because 4 of 8 callers handled it incorrectly. NEXT still had the anti-pattern.
- **Logical test:** New contract `{ ok, status }` is strictly more expressive. Callers updated from `.duplicate` to `.status === 'already_member'`.
- **Receiver-only work preserved:** Yes — only the joinBubble function + its 3 callers touched.
- **Risk:** LOW (PROD version documented as correct; NEXT had known anti-pattern)
- **Status:** ✅ Verified safe · committed `d7cbf0d`

#### Fix 3 — _joinInFlight mutex

- **File:** next/b-bubbles.js (checkQRJoin + checkPendingJoin)
- **Type:** REPLACEMENT (replaced both functions to add mutex)
- **Directionality verification (git):** Checked NEXT's pre-port checkPendingJoin via `git show HEAD~2`. NEXT's only unique content was Mode B handling using the OLD joinBubble contract (`!result.ok`).
- **Logical test:** Old NEXT showed `toast_joined` even when already-member (old `{ok:true,duplicate:true}` had ok=true). New version shows toast only on `status === 'joined_now'`. This is an IMPROVEMENT, not a regression. Mode B fall-through behavior preserved.
- **Risk:** LOW (NEXT-unique content was based on old contract now replaced by ADR-005)
- **Status:** ✅ Verified safe

#### Fix 4 — SIGNED_IN/USER_UPDATED auth listener handlers

- **File:** next/b-auth.js (setupAuthListener)
- **Type:** ADDITIVE (added handlers to existing listener)
- **Directionality verification (git):** NEXT has unique `auth-merge hybrid screen` (v7.86/v7.93). Verified my port was additive to the listener only — did NOT touch hybrid screen logic.
- **Logical test:** New handlers (SIGNED_IN, USER_UPDATED, INITIAL_SESSION) handle multi-tab consistency. Existing SIGNED_OUT/TOKEN_REFRESHED logic untouched.
- **Receiver-only work preserved:** Yes — hybrid screen code intact (verified grep count).
- **Risk:** NONE (additive, receiver-only work confirmed intact)
- **Status:** ✅ Verified safe

#### Fix 5 — resolvePostAuthDestination consumeFlow → flowGet

- **File:** next/b-auth.js
- **Type:** REPLACEMENT (changed flow-flag reading mechanism)
- **Directionality verification (git):** PROD v8.17.31 commit message explicitly documents: "consumeFlow → flowGet to prevent double-clear on race, flowClearAll() now sole authority." NEXT had IDENTICAL pre-fix code that PROD had before v8.17.31.
- **Logical test:** Every branch calls `flowClearAll()` immediately after reading. Old `consumeFlow` cleared-on-read AND `flowClearAll()` cleared again = double-clear race. New `flowGet` (read-only) + `flowClearAll()` (sole cleanup) is correct.
- **Risk:** LOW (PROD fix documented; NEXT inherited same pre-fix code)
- **Status:** ✅ Verified safe

#### Fix 6 — registerState() cleanup in 7 modules

- **Files:** next/b-chat, b-radar, b-home, b-bubbles, b-onboarding, b-realtime, b-live
- **Type:** ADDITIVE (NEXT modules had no registerState; b-bubbles had only _joinInFlight)
- **Prerequisite check:** `registerState()` function exists in next/b-config.js ✅. All cleared variables verified to exist in NEXT via grep.
- **Safety mechanism:** All PROD blocks use `typeof X !== 'undefined'` guards — so even if a variable doesn't exist in NEXT, it fails safe (no error).
- **Logical test:** Pure cleanup-on-logout. GDPR-critical for b-onboarding (consent state). No existing behavior changed.
- **Risk:** NONE (additive with typeof guards)
- **Status:** ✅ Verified safe

---

#### Fix 2 — sendMessage complete rollback

- **File:** next/b-messages.js
- **Type:** REPLACEMENT (error handler block)
- **Prerequisite check:** `_dmLastSent` (6×), `_dedupKey` (defined line 15), `input`+`content` (lines 9-10) all exist in NEXT ✅
- **Directionality verification (git):** PROD v8.17.31 documented complete rollback. NEXT's latest b-messages changes (v8.08/v8.09) were "Vælg/Annuller toggle" design work — verified NOT in sendMessage error handler.
- **Logical test:** PROD adds dedup-clear (`delete _dmLastSent[_dedupKey]`) + input-restore. Old NEXT left dedup guard set (blocked retry 3s) + input emptied. Pure improvement. Same dedup mechanism in both.
- **Receiver-only work preserved:** Vælg/Annuller toggle untouched (elsewhere in file).
- **Risk:** LOW
- **Status:** ✅ Verified safe

#### Fix 7 — SW user-prompted update + acceptUpdate

- **Files:** next/sw.js + next/b-boot.js
- **Type:** REPLACEMENT (SW install/activate/message/notificationclick + b-boot orchestration)
- **Prerequisite check:** CACHE_URLS identical PROD vs NEXT ✅. NEXT CACHE_NAME (bubble-next-v8.34) preserved.
- **Directionality verification (git):** NEXT had OLD disruptive SW (auto skipWaiting + clients.claim on install). PROD v8.17.31 has user-prompted update. NEXT's last SW change was disabled-button feedback (v8.17.28/next-v8.31) — not SW lifecycle.
- **Logical test:**
  - install: removed `skipWaiting()` → SW waits in installed state
  - activate: removed `clients.claim()` → no mid-session disruption; added client notification
  - message handler: added `SKIP_WAITING` → user-triggered activation
  - fetch: added `api.bubbleme.dk` filter → prevents stale API caching
  - notificationclick: focused→visible→any sorting (improvement over first-available)
  - b-boot: acceptUpdate() + controllerchange + updatefound listeners
- **Receiver-only work preserved:** CACHE_NAME (bubble-next-v8.34), CACHE_URLS (identical). No NEXT-only SW logic existed.
- **Risk:** MEDIUM (lifecycle-critical, but structure verified clean)
- **Status:** ✅ Verified safe

---

### Session 1 — COMPLETE (workstream 1)

All 8 PROD hardening fixes ported to NEXT with directionality verification:
- Fix 1 (UUID), ADR-005 (joinBubble), Fix 3 (mutex), Fix 4 (auth handlers),
  Fix 5 (flowGet), Fix 6 (registerState), Fix 2 (rollback), Fix 7 (SW update)
- All verified safe via type classification + git provenance + logical test
- NEXT design v6 work preserved (auth hybrid screen, Vælg/Annuller toggle)
- NEXT version bumped 8.32 → 8.34 across two batches

**Methodology validation:** Every replacement was verified against git history. No NEXT improvements overwritten. No bugs reintroduced. The "PROD always wins" assumption was tested per-fix, not assumed.

---

## Pending workstream 2 — NEXT improvements → PROD

Not yet started. NEXT has features/fixes PROD lacks (e.g. auth hybrid screen, design v6). These need classification:
- **Real improvement** → port to PROD
- **Real drift** (unintended) → correct or document

See PROD-NEXT-DRIFT.md for the catalog.

---

*Sidste opdatering: Maj 2026 (Session 1 — workstream 1 in progress)*
