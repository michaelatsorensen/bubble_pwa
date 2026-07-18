# Bubble Smoketest — sådan kører du den

Backend-smoketests for create-first onboarding. Tester **logik + datalag** mod ægte
Supabase. Tester **ikke** PWA-install/standalone/visuelt flow — det kræver en rigtig enhed.

## Engangs-opsætning

Fra din terminal, i en mappe hvor du vil køre scriptet (fx `bubble-edge`):

```bash
npm install @supabase/supabase-js
```

Det er den eneste afhængighed.

## Sådan køres den

Service_role-nøglen findes i Supabase → Settings → API → `service_role` (markeret *secret*).
Den omgår RLS og kan slette brugere — behandl den som en adgangskode.

```bash
SUPABASE_SERVICE_KEY="din-service-role-nøgle" node scripts/smoketest.mjs
```

**Nøglen må ALDRIG hardkodes i scriptet eller committes til git.** Den gives kun som
miljøvariabel ved kørsel, så den aldrig efterlader spor.

## Hvad den gør

1. **Sikkerhedsnet først:** finder og sletter forældreløst `__smoke_`-affald fra
   tidligere kørsler der måtte være crashet.
2. **Kører testene:** bruger-oprettelse, QR-token-resolve, RLS-grænse (anon kan ikke
   læse profildata), idempotens (dobbelt kontakt-gemning giver én kontakt).
3. **Rydder op efter sig selv:** hver testbruger slettes via `gdpr_delete_user` +
   auth-sletning, uanset om testene bestod.

## Hvis noget efterlades

Oprydningen er vandtæt via `__smoke_`-præfikset, men skulle en kørsel dø på en
usædvanlig måde, kan alt testaffald altid findes:

```sql
-- I Supabase SQL Editor:
select id, email from auth.users where email like '__smoke_%';
```

Og fjernes (kald gdpr_delete_user for hver, slet så auth-brugeren). Kør bare scriptet
igen — sikkerhedsnettet rydder op ved næste start.

## Vigtigt

- Kører mod **produktion** (`api.bubbleme.dk`). Testbrugere er ægte rækker mens de
  eksisterer, men ryddes straks.
- Nogle tests antager tabel-/RPC-navne (`qr_tokens`, `resolve_qr_token`,
  `saved_contacts`, `gdpr_delete_user`). Fejler en test på et manglende navn, er det
  fordi mekanismen hedder noget andet — sig til, så retter vi scriptet.
