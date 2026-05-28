# Bubble — Feature Ideas & Backlog

> **Levende dokument.** Samlet idé-backlog adskilt fra teknisk gæld (TECH-DEBT.md), åbne spørgsmål (OPEN-QUESTIONS.md) og arkitektur-beslutninger (ARCHITECTURE-DECISIONS.md). Seedet 28. maj 2026 via systematisk gennemgang af tidligere samtaler (marts–maj 2026) for at genfinde idéer der aldrig blev formaliseret.
>
> **Status-nøgle:** ✅ Bygget · 📋 Spec'et (klar) · 💬 Diskuteret · ⏸️ Parkeret (besluttet udskudt) · ❌ Forkastet
>
> **Ikke udtømmende.** Tilføj løbende når nye idéer dukker op, så de ikke går tabt igen.

---

## Event-features

| Idé | Status | Note |
|---|---|---|
| **Agenda/program-scan → opret event** | 📋 Spec'et (7. apr) | `scan-event` Edge Function m/ Claude Vision: foto/screenshot af program → JSON (navn, dato, tid, sted, agenda, keywords) → pre-fill opret-event-form. Klient: `scanEventImage`/`handleEventScan`/`_applyScannedEvent`. ~2 timer, ~$0.01-0.03/scan. Spec klar — byg når første event-kunde beder om det. |
| **Batch-scan: ét program → flere child-events** | 💬 Diskuteret | Ét foto af konferenceprogram (8 sessioner) → opretter alle child-events. Konkret differentiator mod Brella/Luma (de kræver manuel CMS-indtastning). Udvidelse af scan-spec: prompt returnerer array + preview/rediger-UI. Rækkefølge: pilot → event-kunde → scanner → batch. |
| **Personlig tracking-boble** | 💬 Diskuteret | Egen boble hvor man scanner møder/events ind for at holde styr på dem. Bygger på scan-featuren. |
| **URL-scan af eventside** | 💬 Diskuteret | Indsæt link → Edge Function fetcher HTML → parser til event. Fremtidig udvidelse af scan. |
| **"Opret lignende" / gentagne events** | 💬 Diskuteret | Knap der kopierer eksisterende event. |
| **Auto-keywords fra agenda** | 💬 Diskuteret | Claude foreslår tags baseret på agenda-indhold. |

## Discovery & matching

| Idé | Status | Note |
|---|---|---|
| **Live-first prioritering** | 💬 Diskuteret (anbefalet først) | Sortér home/bobler efter live-aktivitet, ikke statisk medlemstal. "3 live lige nu" m/ pulserende dot føles levende ved få brugere. Bruger eksisterende `checked_in_at`. Lille ændring, stor effekt. **Bør verificeres om bygget.** |
| **Explore Bubbles (topic → bubble → people)** | 💬 Diskuteret (v2.5) | Discovery via bobler ("gå ind i et rum") frem for ren tag-søgning. Infrastruktur findes (bobler m/ tags, medlemmer, presence) — mangler discovery-overflade. |
| **Community graph (person → boble → boble → person)** | 💬 Diskuteret (v3+) | Discovery-paths gennem netværket. Den langsigtede "community-discovery platform"-vision. |
| **Match-forklaringer** | 💬 Diskuteret | "3 fælles interesser: cleantech, energy, bæredygtighed" under match-label. ~20 linjer kode, stort UX-løft. **Bør verificeres om bygget.** |
| **Match scoring v3 (tier-baseret)** | 💬 Diskuteret | Erstatning for TF-IDF: sektor-overlap, livsfase, tag-cluster, shared bubbles, cross-match, completeness-bonus. **Memory siger v2 TF-IDF+sigmoid er aktiv — afklar om v3 blev implementeret.** |

## Engagement & onboarding

| Idé | Status | Note |
|---|---|---|
| **Profil-styrke gamification** | ✅ delvist | "Styrk din profil" m/ belønningsbeskeder ("Tilføj titel → unlock 5+ matches"). Profil-styrke meter findes. |
| **Social proof før signup** | ⏸️/❌ | "238 professionelle bruger Bubble" + anonymiserede profil-kort før signup. `screen-social-proof` blev dead code (onboarding forenklet til hurtigst muligt ombord). Kan genovervejes. |
| **Event-aware home banner** | 💬 Diskuteret | "Du er til TechBBQ · 12 personer her · 3 stærke matches". **Bør verificeres om bygget.** |
| **Event-mode radar (top 5 først)** | 💬 Diskuteret | Vis top 5 matches, resten bag "vis flere" i event-kontekst. **Bør verificeres.** |
| **"Refresh members"-knap i live-view** | 💬 Diskuteret | Eksplicit safe fallback hvis realtime svigter. |

## Revenue & premium

| Idé | Status | Note |
|---|---|---|
| **Profilvisninger (B2C freemium)** | 💬 Revenue lag 3 | Gratis=antal visninger, betalt=navne+kontekst. 29-49 DKK/md. Ikke bygget. |
| **"Browse anonymt" (premium)** | ⏸️ Besluttet (11. apr) | Anonym-toggle FJERNET fra UI under pilot (`is_anon` bevaret i DB). Genintroducér post-pilot som "browse uden at efterlade spor" under Profilvisninger-abonnement — ikke som "skjul navn". |
| **Corporate Bubbles** | 💬 Revenue lag 2 | Virksomhedsprofil m/ logo, envejs broadcast+reaktioner, analytics-dashboard, push, knytter events til corp. 199-2.499/md. Approval-proces overvejes mod spam. |
| **Verified Bubbles** | 💬 Revenue lag 4 / strategisk kerne | Org-ejerskab (overlever personaleskift), roller (ejer/admin/mod), verified badge. 1-25K/år. Den langsigtede moat. |
| **Event Bubbles (reverse QR)** | ✅ delvist | Reverse QR check-in findes. Premium event-pakke (deltagerindsigt, admin, fremmøde-tracking) er revenue-laget. |

## Allerede bygget (bekræftet)

| Feature | Note |
|---|---|
| **Personlig QR + reverse-onboarding** ✅ | connect_code, screen-qr-preview, 4 rekrutteringsveje (?qrt/?event/?join/organisk). Den vigtigste growth engine — bekræftet bygget. |
| **Drag-to-reorder home** ✅ | "Flyt ✦" → wiggle → gem rækkefølge i localStorage. |
| **ADR-009 invitations-tilbagekald** ✅ | v8.50. |

## Parkerede/udskudte (tekniske, se også TECH-DEBT.md)

- **Geolokation til match-scoring** (P2) — last_lat/lng + distance-multiplier. Ikke før piloten er landet.
- **onboarding_status kolonne** — eksplicit state frem for heuristik. Post-pilot.
- **File URL strategi** — getPublicUrl vs TTL. Uafklaret, post-pilot.
- **Custom SMTP** — emails kommer stadig fra Supabase-domæne.
- **ADR-008 lilla-token-migration** — struktureret, ikke eksekveret.
- **ADR-009 punkt 2: ejerskab request-flow** — besluttet, ikke bygget.
- **Invite-modal live-refresh** (P3) — sjælden kant, bevidst udskudt.

## Chat/realtime refaktor-kandidater (se TECH-DEBT)

- Split `openBubbleChat()` → `loadChatData()` + `subscribeChatRealtime()` (timing-risiko).
- Badge dedup m/ `_localId` (ghost-badges). **Memory: dmReduceMsg/bcReduceMsg dedup bygget — afklar overlap.**
- DM typing indicator + read receipts — nævnt i realtime-arkitektur, **verificér om bygget.**

---

*Seedet 28. maj 2026 fra samtale-gennemgang (marts–maj). Flere "verificér om bygget"-poster bør tjekkes mod kodebasen og opdateres. Tilføj nye idéer her løbende.*
