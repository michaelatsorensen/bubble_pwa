# Bubble Native v1 — Observability

> **Purpose:** Define crash reporting, error tracking, analytics, and flow tracing BEFORE day 1 of native development. Lack of observability is what made PWA debugging painful (Q-050, Q-054 exist because we lack push observability).
>
> **Status:** SKELETON — to be filled in before native development kickoff
>
> **Anchored to:** ADR-007, Tenet 1 (backend normalization includes observability)
>
> **Critical principle:** *"Observability is dag 1 setup, not 'add later.' We will not repeat PWA's learning curve."*

## Why this document exists

PWA evolved without observability strategy. Consequences:

- We don't know if push triggers fire correctly (Q-050)
- We don't have push delivery logs (Q-054)
- Auth lock timeouts may fail silently (Q-059)
- Error logs exist but no monitoring/alerting

Native v1 MUST be different. Decisions about observability stack made BEFORE code starts.

## What observability covers

Four distinct concerns, each with its own tool:

### 1. Crash reporting

**What:** Native crashes, JS errors, ANR (Android Not Responding), iOS crashes

**Why:** App Store reviews are damaged by crashes. We must know about every crash in production.

**Candidates:**
- **Sentry** (most popular, good React Native integration, generous free tier)
- **Bugsnag** (alternative)
- **Crashlytics** (Firebase, free)

**Decision needed:** Sentry vs Crashlytics. Sentry probably wins for unified web+native.

**TBD:** Final decision + setup

### 2. Flow analytics

**What:** What screens users visit, how long they stay, where they drop off, what features they use

**Why:** We don't know what features matter without data. PWA-pilot-on-PWA was meant to provide this; native-as-primary means analytics from native dag 1.

**Candidates:**
- **PostHog** (open source, generous free tier, good React Native support)
- **Mixpanel** (mature, expensive at scale)
- **Amplitude** (similar to Mixpanel)
- **Supabase Analytics** (basic, if minimal needs)

**Decision needed:** Probably PostHog (matches solo founder budget + privacy stance).

**TBD:** Event taxonomy (what events to track, in DA naming convention or EN?)

### 3. Error logging (active monitoring)

**What:** Application-level errors (failed DB writes, auth failures, edge cases). PWA's `logError()` pattern but with active monitoring.

**Why:** PWA has `error_log` table but nobody monitors it. Native must surface errors to developer attention.

**Approach:**
- Continue `logError` pattern in native
- Pipe to Sentry (categorized as warnings, not crashes)
- Set up alerts for spike in error rate
- Daily review during pilot

**TBD:** Alert thresholds, notification channels (email? Slack?)

### 4. Performance monitoring

**What:** Screen load times, API call durations, render performance

**Why:** Native apps are judged on smoothness. 60fps is the bar. Slow screens damage retention.

**Candidates:**
- Sentry Performance (if using Sentry for crashes)
- Firebase Performance Monitoring (free)
- React Native Performance Monitor (dev-only)

**TBD:** What metrics matter most for Bubble (probably: time-to-interactive, realtime message latency, push delivery time)

## What gets tracked — event taxonomy (TBD)

Following PWA's pattern, events should be:

- **Action-based:** `bubble_joined`, `dm_sent`, `event_check_in`
- **Categorized:** `auth.*`, `bubble.*`, `dm.*`, `live.*`, `discovery.*`
- **Property-rich:** Each event has context (user_id, bubble_type, etc.)
- **PII-conscious:** No message content, no personal data in event properties

PWA tracks these (sample):
- `bubble_joined`, `bubble_join_duplicate`
- `dm_sent`
- `live_check_in`, `live_check_out`
- `event_report_generated`
- `invite_sent`

Native should track:
- All of the above (1:1 mapped)
- Lifecycle events: `app_opened`, `app_resumed`, `app_killed_by_os`
- Push events: `push_received`, `push_tapped`, `push_dismissed`
- Performance: `screen_loaded`, `api_slow`, `realtime_reconnect`

**TBD:** Complete event taxonomy document

## Privacy & GDPR

Native analytics has same GDPR requirements as PWA:

- User consent before tracking (re-use consent flow design)
- No tracking before consent given
- User can disable analytics (settings option)
- Data retention limits
- Right to deletion includes analytics data

**TBD:** GDPR-compliant analytics setup with chosen tool

## Setup as dag 1 task

When `bubble-native-lab` is created, observability is in **first commit**:

```
day 1:
- expo init
- install Sentry SDK
- install PostHog SDK
- configure both for dev environment
- write first event: app_initialized
```

Not "we'll add it when we have time." If first commit doesn't have observability, we've already failed.

## Cost projection (rough)

For pilot (50-100 users) + early growth:

- **Sentry:** Free tier (5K errors/month) — sufficient
- **PostHog:** Free tier (1M events/month) — sufficient for early
- **Total monthly cost:** 0 DKK during pilot, ~50-200 DKK/month at scale

This is affordable for solo founder. No excuse to skip.

## Anti-patterns to avoid

From PWA experience:

- **"Console.log is enough"** → No, errors don't surface
- **"Add analytics later"** → No, we miss critical learnings
- **"We'll know when users complain"** → No, most users don't complain, they churn
- **"Database is our log"** → No, can't query at scale, no alerts
- **"We don't need it for MVP"** → No, MVP is when we need it most

## Update process

When adding new feature:

1. What events should this generate?
2. What errors could occur, how should they surface?
3. What performance metric matters?
4. Document above before merge

---

*To be populated during pre-kickoff planning session (target: late juli 2026)*
