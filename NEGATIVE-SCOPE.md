# Bubble Native v1 — Negative Scope

> **Purpose:** Document what is EXPLICITLY NOT in native v1. Negative scope is more important than positive scope, because it's what gets saved.
>
> **Status:** SKELETON — to be filled in before native development kickoff (target: late juli 2026)
>
> **Anchored to:** ADR-007 (Native as primary strategic direction), Tenet 5 (Distill, don't port)

## Why this document exists

Without explicit "not in scope" list, scope creep is guaranteed. When a feature exists in PWA, the natural instinct is "of course we port it." This document defends against that instinct.

Every feature in PWA falls into one of three categories:

1. **CORE** — must be in native v1
2. **DEFERRED** — important but waits for v1.1 or later
3. **WEB-ONLY** — never planned for native, lives in PWA fallback or web tool

This document focuses on categories 2 and 3.

## Decision criteria

A feature is **NOT** in native v1 if any of:

- It's only used by <5% of users (premature optimization)
- It exists primarily for admin/moderation (can use PWA admin tool)
- It's intrinsically web-only (e.g., desktop-optimized reporting)
- It's expensive to port relative to user value
- It's still being validated in PWA (don't bake-in unvalidated)
- It can be added incrementally post-launch without breaking core

## Categories to evaluate

### Admin & moderation

> *(TBD — list each admin feature, categorize as CORE/DEFERRED/WEB-ONLY)*

Likely candidates for DEFERRED or WEB-ONLY:
- Member PDF export
- Event report generation
- User moderation tools
- Block/report flows (basic in v1, advanced deferred)

### Settings & profile

> *(TBD)*

Likely candidates for DEFERRED:
- Advanced profile editor (avatar crop, etc.)
- Notification preferences detail
- Language switcher (DA default, EN later)
- Theme/appearance settings

### Discovery features

> *(TBD)*

Question to resolve:
- Is Discover tab (upvotes, verified) in v1?
- Is full Radar in v1 or simplified?
- Are saved contacts in v1?

### Event/Bubble features

> *(TBD)*

Likely CORE:
- Live Bubble check-in (event central to VL)
- Bubble chat (basic)
- Join via deep-link

Likely DEFERRED:
- Bubble creation flow (advanced types)
- Bubble icons selection (use defaults in v1)
- Bubble agenda editing
- Parent/child bubble hierarchy

### Messaging features

> *(TBD)*

Likely CORE:
- DM send/receive
- DM history
- Push notifications

Likely DEFERRED:
- GIF picker (use text/photo only in v1)
- Message editing
- Message reactions
- File uploads (photos only in v1, files deferred)

## "Allowed to be lower quality in v1" list

> *(TBD — features that ARE in v1 but where rough edges are acceptable)*

Examples (placeholder):
- Onboarding: simpler tag picker, no advanced personalization
- Profile views: counts only, no detailed analytics
- Live presence: basic dot indicator, no advanced status

## What this document is NOT

- Not a roadmap (that's NATIVE-MIGRATION.md)
- Not a wishlist (that's a separate ideas file)
- Not "things we'll never build" — only "not in v1"

## Update process

When the question "should X be in native?" comes up:

1. Check this document first
2. If listed: respect the decision
3. If not listed: add it here with rationale
4. Decision is reversible but requires explicit ADR amendment

---

*To be populated during pre-kickoff planning session (target: late juli 2026)*
