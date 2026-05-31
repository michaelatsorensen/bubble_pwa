# Bubble — Tech Debt Registry

> **Formål:** Samlet oversigt over kendt teknisk gæld med owner, priority og påvirkning.
>
> **Hvornår tilføjes til denne fil?** Når en tech-debt-item er identificeret med tilstrækkelig dybde (ikke bare "vi burde rydde op" — skal have konkret beskrivelse, root cause hypothesis, og fix scope).
>
> **Status:** Oprettet maj 2026. Migration fra ARCHITECTURE-MAP.md "failure modes" sker gradvist.

## Konventioner

### Priority

- **P0 — Critical:** Security, data loss, irreversible migration risk
- **P1 — Native blocker:** Skal løses før Q1 2027 native rewrite
- **P2 — Operational:** Affecter daglig drift eller observability
- **P3 — Cleanup:** Nice-to-have, dead code, naming consistency

### Status

- **IDENTIFIED** — kendt men ikke planlagt
- **PLANNED** — i roadmap med rough ETA
- **IN_PROGRESS** — aktivt arbejde
- **RESOLVED** — fixed, dokumenteret som lærings-entry
- **WONT_FIX** — accepteret som permanent trade-off

### Skabelon

```markdown
## TD-XXX: [Kort titel]

**Priority:** P0 | P1 | P2 | P3
**Status:** IDENTIFIED | PLANNED | IN_PROGRESS | RESOLVED | WONT_FIX
**Owner:** Michael / TBD
**Estimated fix:** S (1-2h) | M (half day) | L (1-2 days) | XL (week+)

### Symptom
Hvordan manifesterer det sig?

### Root cause (hypothesis)
Hvad er årsagen — og hvor sikre er vi?

### Impact
- User-facing: ...
- Developer-facing: ...
- Future-facing (native): ...

### Fix sketch
Konkret approach. Ikke fuld design — bare retning.

### Related
- Open questions: Q-XXX
- ARCHITECTURE-MAP.md sektion: ...
- ADR (hvis fix kræver beslutning): ADR-XXX
```

---

## Tech Debt Items

*Ingen items migreret endnu. Første kandidater fra Section 19:*

### Candidates pending migration from ARCHITECTURE-MAP.md Section 19

Følgende failure modes er allerede dokumenteret og bør migreres til TD-format efter Q-050 til Q-055 er verificeret:

| Kandidat | Foreslået priority | Source |
|---|---|---|
| Hardcoded secrets in trigger functions | **P0** (security) | FM-3, Q-055 |
| recipient_id vs user_id mismatch | **P1** (silent failures) | FM-1, Q-051, Q-052 |
| Double triggers on invitations | **P1** (UX bug) | FM-2, Q-050 |
| Parallel dispatch via b-utils.js sendPush() | **P2** (cleanup) | FM-4, Q-053 |
| No push delivery logging | **P1** (native blocker — observability required) | FM-6, Q-054 |
| No retry/idempotency | **P2** (operational) | FM-7 |
| Body format mismatch | **P1** (silent failures) | FM-5, Q-051 |

---

*Sidst opdateret: 18. maj 2026*

---

## Opdatering 28. maj 2026

### ✅ LØST — push-gæld (ADR-006 lukket)
Hele push-tabellen ovenfor er adresseret af ADR-006: hardcodede secrets fjernet (Vej A — header unødvendig pga --no-verify-jwt, ingen Vault), recipient_id→user_id fikset, dobbelt-triggers konsolideret (3 canonical tilbage), push_events observability bygget, frontend sendPush fjernet for trigger-dækkede typer. Push er nu backend-ejet + observerbart.

### Nye poster

| Post | Priority | Note |
|---|---|---|
| Invite-modal live-refresh | **P3** | Afsenders åbne invite-modal opdaterer ikke "Afventer" når modtager afviser et andet sted. Luk+åbn fikser det. Bevidst udskudt (ADR-009) — sjælden kant, realtime-kompleksitet dårlig bytte. Byg kun hvis pilot viser det generer. |
| Dobbelt DELETE-policy på bubble_invitations | **P3** | "Owner can delete invitations" + "bubble_invitations_delete" overlapper (begge tillader sletning, OR-baseret = harmløs redundans). Ryd op ved generel policy-oprydning. |
| ADR-009 punkt 2 — ejerskab request-flow | **(feature, ikke debt)** | Migration (pending_owner kolonner) + 2 RPC'er (accept/afvis) + frontend-split + modtager-UI. Besluttet, ikke bygget. |
| Sheet-animation harmonisering | **P3** | Bund-sheets bruger uensartet open-easing: de fleste (modal-sheet, person-sheet) har bounce `cubic-bezier(0.34,1.56,0.64,1)`; list-view (home-tray) + guide-sheet (v8.84) bruger ren glid `cubic-bezier(0.32,0.72,0,1)`. **Indsigt (maj 2026):** den rene glid er referencen — den føles mest gennemarbejdet OG bounce-overshootet kan løfte sheetens bund over skærmkanten = kortvarigt hvidt gab (set+fikset på guide-sheet i v8.84). JS-open-mekanik er også uensartet (setTimeout(10) vs void offsetHeight vs double-rAF vs bare classList — alle virker, ingen er knækket). Harmonisér ALLE bund-sheets til ren glid + ét open-mønster. Rører person-sheet/gif-picker/bb-sheet m.fl. — tag som egen fokuseret opgave EFTER pilot, ikke midt i test. |

*Sidst opdateret: 28. maj 2026*
