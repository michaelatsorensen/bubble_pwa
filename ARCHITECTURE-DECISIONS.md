# Bubble — Architecture Decisions (ADR)

> **Formål:** Registry over accepterede arkitekturbeslutninger.
>
> **Hvornår tilføjes en ADR?** Når en beslutning er truffet (ikke længere spørgsmål) og har påvirkning på flere komponenter eller fremtidig arkitektur.
>
> **Format:** Hver ADR har: id, status, context, decision, consequences.
>
> **Status:** Oprettet maj 2026. Migration fra OPEN-QUESTIONS.md sker gradvist.

## Konventioner

### Status-værdier

- **PROPOSED** — under overvejelse, ikke endelig
- **ACCEPTED** — besluttet, gælder fremadrettet
- **DEFERRED** — udskudt til senere fase (typisk native rewrite)
- **DEPRECATED** — tidligere accepted men erstattet af nyere ADR
- **REJECTED** — eksplicit afvist (med begrundelse)

### Skabelon

```markdown
## ADR-XXX: [Kort titel]

**Status:** PROPOSED | ACCEPTED | DEFERRED | DEPRECATED | REJECTED
**Date:** YYYY-MM-DD
**Supersedes:** ADR-YYY (hvis relevant)

### Context
Hvilken situation/problem fører til beslutningen?

### Decision
Hvad vi har besluttet at gøre.

### Consequences
- Positive (hvad bliver lettere)
- Negative (trade-offs)
- Neutral (ting der ændres uden klar plus/minus)

### Related
- Open questions resolved: Q-XXX
- Files affected: ...
- Cross-reference til ARCHITECTURE-MAP.md sektion X
```

---

## ADRs

*Ingen ADRs registreret endnu. Første kandidater fra Section 19 (Push Flow):*

### Candidates pending migration from OPEN-QUESTIONS

Følgende decisions er allerede dokumenteret i OPEN-QUESTIONS.md og bør migreres til ADR-format når de er formelt accepted:

1. **Push dispatch contract** — `recipient_id` over `user_id` (fra Q-052 analyse)
2. **Single source of dispatch** — DB triggers er authoritative, `b-utils.js sendPush()` deprecated (fra Q-053)
3. **Vault for secrets** — alle hardcoded secrets i trigger functions migreres til vault.secrets (fra Q-055)
4. **Push observability** — `push_delivery_log` table tilføjes som persistent audit log (fra Q-054)

Disse migreres når Q-050 til Q-055 er verificeret med ground truth.

---

*Sidst opdateret: 18. maj 2026*
