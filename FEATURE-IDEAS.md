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
| **Live-first prioritering** | ✅ delvist (verificeret) | Live-presence + live-banner bygget (`liveCount`, `appMode.set('live')`, home-live-banner). MEN eksplicit *sortering* af boble-listen efter live-antal er ikke bekræftet i koden — kan stadig være statisk medlemstal-sortering. Verificér/byg selve sorteringen. |
| **Explore Bubbles (topic → bubble → people)** | 💬 Diskuteret (v2.5) | Discovery via bobler ("gå ind i et rum") frem for ren tag-søgning. Infrastruktur findes (bobler m/ tags, medlemmer, presence) — mangler discovery-overflade. |
| **Community graph (person → boble → boble → person)** | 💬 Diskuteret (v3+) | Discovery-paths gennem netværket. Den langsigtede "community-discovery platform"-vision. |
| **Match-forklaringer** | ✅ Bygget (verificeret) | `sharedTags` vises som chips under match i home (b-home.js:2024) + shared_interest i radar/profil. BEMÆRK: bruger deprecated lilla (`var(--accent)`) — hører under ADR-008. |
| **Match scoring v3 (tier-baseret)** | ✅ Bygget (verificeret) | b-radar.js: "SMART MATCH ALGORITHM (v3 — Tier-based) — Replaces TF-IDF". 5 tiers + completeness, cap 25, common tags belønnes. **Hukommelse rettet (sagde fejlagtigt v2 TF-IDF).** |
| **Live filtrerbar dartskive ("levende boble")** | ✅ ~60% (verificeret) — winner-kandidat, FEEL BESLUTTET | Vision (magnet-metafor): justér filter → ikke-match frastødes radialt UD over kanten (accelererende), match tiltrækkes IND fra kanten mod plads, blivende dots glider til ny position (stærkere match → tættere på centrum). FINDES: `filterRadarHome` + drip-in på `.prox-dot` + re-render ved filterændring. MANGLER: exit-animation + diff-baseret render. **FEEL BESLUTTET (prototype maj 2026): "Blød/glidende"** — exit ~650ms cubic-bezier(0.4,0,0.6,1), enter ~650ms cubic-bezier(0.25,0.9,0.4,1), move ~600ms cubic-bezier(0.4,0,0.2,1). Passer strandglas-æstetik (rolige flydende bevægelser). Prototype-kilde: mockup-magnetic-dartboard.html (outputs). Byg som egen fokuseret session. |

## Engagement & onboarding

| Idé | Status | Note |
|---|---|---|
| **Profil-styrke gamification** | ✅ delvist | "Styrk din profil" m/ belønningsbeskeder ("Tilføj titel → unlock 5+ matches"). Profil-styrke meter findes. |
| **Social proof før signup** | ⏸️/❌ | "238 professionelle bruger Bubble" + anonymiserede profil-kort før signup. `screen-social-proof` blev dead code (onboarding forenklet til hurtigst muligt ombord). Kan genovervejes. |
| **Event-aware home banner** | 💬 Diskuteret — IKKE bygget (verificeret) | "Du er til TechBBQ · 12 personer her · 3 stærke matches". Ingen forekomst i koden. Reelt åben idé. |
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
- DM typing indicator + read receipts — nævnt i realtime-arkitektur-doc, men **IKKE bygget** (verificeret: ingen typing/read_receipt/seen_at i b-chat.js/b-messages.js). Reel åben idé hvis ønsket.

---

*Seedet 28. maj 2026 fra samtale-gennemgang (marts–maj). Flere "verificér om bygget"-poster bør tjekkes mod kodebasen og opdateres. Tilføj nye idéer her løbende.*

---

## Magnetisk dartskive — v1 spec (besluttet retning, maj 2026)

Konvergeret efter prototype + to runder eksternt input. Status: retning besluttet, byg som egen fokuseret session (ikke v1 endnu).

**Låst:**
- **UI:** Tilgang B (segment-skifter "For mig | Jeg søger"), ét aktivt filter ad gangen. "+" folder filter ind/ud (eksisterende mekanik).
- **Sortering: HÅRD.** Passer en profil ikke filteret, fises den HELT ud over kanten og væk. Vil man se vedkommende igen: tilbage til "Alle" eller vælg et filter de passer. (Besluttet for nu — revisitabel, Michael åben for andre modeller.)
- **Feel:** Blød/glidende easing (exit ~650ms cubic-bezier(0.4,0,0.6,1), enter ~650ms cubic-bezier(0.25,0.9,0.4,1), move ~600ms cubic-bezier(0.4,0,0.2,1)).
- **Motion-regel:** Ingen bevægelse uden betydning (guardrail mod UI-cirkus).
- **Scope-regel:** Ét aktivt intent ad gangen. INGEN kombinationsfiltre i v1.
- **Discovery-regel:** Chips er BREDE (sektorer), ikke præcise. Skal mappe til eksisterende scoring-taksonomi (sektorer/clusters/dynamic_keywords) — ALDRIG parallel ontologi.
- **Intent-kilde:** Profil = baseline (`dynamic_keywords`), radar = live override.
- **Eksplicit UDE af v1 re-score:** geo, activity, distance — kun intent driver re-scoring (undgå "AI sorting mystery machine").

**Leaning (ikke låst — afklar før build):**
- **Akse-asymmetri:** "For mig" = passivt medlemskabs-filter (ændrer hvem der vises, re-sorterer IKKE positioner). "Jeg søger" = aktiv re-scoring (reorganiserer hele relevans-rummet, intent magnetiseres mod centrum). Stærk mental model, men ikke endeligt bekræftet af Michael.

**ÅBENT — vend tilbage:**
- **Serendipitet:** Hård udrensning (valgt nu) vs tynd "halo" ved randen så radaren aldrig tømmes helt og bevarer uventede overlap. Michael usikker, holder åbent. Feel-tuning, ikke arkitektur — kan afgøres i prototype/pilot.

**Teknisk forudsætning (verificeret):** `calcMatchScore(myProfile, theirProfile, sharedBubbleCount)` læser intent fra `myProfile.dynamic_keywords` (Tier 5 cross-match). Live override kræver lille udvidelse: lade funktionen tage live-intent (samme mønster som planlagt geo-`distanceKm`-argument).
