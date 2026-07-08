// ════════════════════════════════════════════════════════════
//  b-terms.js — Shared Terms & Privacy Policy content (v1.2)
//  Single source of truth for BOTH the app (showTerms) and landing.html.
//  Class-based markup only (no inline colours) — each surface styles
//  .tms-body via its own CSS (app = dark sheet, landing = light page).
//  Email rendered as <span class="tms-email"></span>, populated per surface.
// ════════════════════════════════════════════════════════════

var TERMS_DA = `
<div class="tms-body">
  <p class="tms-intro">Version 1.2 · Sidst opdateret: Juni 2026</p>
  <p>Dette dokument beskriver vilkår for brug af Bubble samt hvordan Bubble behandler personoplysninger. Bubble er i beta, og dokumentet kan blive opdateret i takt med at tjenesten udvikles.</p>

  <h3><span class="tms-n">1.</span> Hvad er Bubble?</h3>
  <p>Bubble er en networking-platform udviklet i Sønderborg, Danmark. Bubble hjælper brugere med at finde relevante personer, bobler, events og faglige fællesskaber baseret på profiloplysninger, interesser, relationer, deltagelse i bobler/events og kontekstuel relevans.</p>
  <p>Bubble er særligt udviklet til professionelle netværk, lokale communities, events, konferencer, virksomheder, foreninger og faglige miljøer, hvor mennesker har brug for et digitalt rum omkring et fysisk eller fagligt fællesskab.</p>
  <p>Bubble er i øjeblikket i beta. Det betyder, at platformen fortsat testes, forbedres og ændres.</p>

  <h3><span class="tms-n">2.</span> Dataansvarlig og kontakt</h3>
  <p>Dataansvarlig for behandling af personoplysninger i forbindelse med Bubble er:</p>
  <p>Michael Sørensen<br>Sønderborg, Danmark<br>Kontakt: <span class="tms-email"></span></p>
  <p>Hvis Bubble senere drives gennem et selskab, forening eller anden juridisk enhed, vil denne information blive opdateret.</p>

  <h3><span class="tms-n">3.</span> Accept af vilkår</h3>
  <p>Ved at oprette en bruger, logge ind eller bruge Bubble accepterer du disse betingelser og denne privatlivspolitik.</p>
  <p>Hvis du ikke kan acceptere vilkårene, skal du undlade at bruge Bubble.</p>
  <p>Bubble er målrettet voksne og professionelle brugere. Platformen er ikke målrettet børn.</p>

  <h3><span class="tms-n">4.</span> Beta-forbehold</h3>
  <p>Bubble er i beta. Det betyder, at:</p>
  <ul>
    <li>funktioner kan ændres, tilføjes eller fjernes uden varsel</li>
    <li>der kan forekomme fejl, nedetid, manglende funktionalitet eller datatab</li>
    <li>brugeroplevelsen kan ændre sig løbende</li>
    <li>data og testmiljø kan blive ryddet op, ændret eller nulstillet som led i udviklingen</li>
    <li>der ikke gives garanti for oppetid, fuldstændig dataintegritet eller uafbrudt adgang</li>
  </ul>
  <p>Vi gør vores bedste for at drive Bubble sikkert og ansvarligt, men Bubble leveres i beta "as is".</p>
  <p>Du bør ikke bruge Bubble til kritisk kommunikation, fortrolige forretningsoplysninger, følsomme personoplysninger eller oplysninger, som ikke må gå tabt.</p>

  <h3><span class="tms-n">5.</span> Hvad du må bruge Bubble til</h3>
  <p>Du må bruge Bubble til at:</p>
  <ul>
    <li>oprette og vedligeholde en professionel profil</li>
    <li>finde relevante personer, bobler, netværk og events</li>
    <li>deltage i bobler og events</li>
    <li>kommunikere med andre brugere</li>
    <li>gemme kontakter og relevante relationer</li>
    <li>oprette bobler, hvis funktionen er tilgængelig for dig</li>
    <li>administrere bobler/events, hvis du er ejer eller administrator</li>
    <li>teste og give feedback på platformen</li>
  </ul>
  <p>Du må ikke bruge Bubble til:</p>
  <ul>
    <li>spam, chikane, stalking eller uønsket kontakt</li>
    <li>hadefuldt, truende, diskriminerende eller ulovligt indhold</li>
    <li>vildledning, impersonation eller falske profiler</li>
    <li>deling af følsomme eller fortrolige oplysninger uden relevant grundlag</li>
    <li>forsøg på at omgå adgangskontrol, sikkerhed eller rettigheder</li>
    <li>scraping, masseudtræk eller automatiseret indsamling af brugerdata</li>
    <li>upload af skadelige filer, malware eller ulovligt materiale</li>
    <li>kommerciel udnyttelse uden aftale med Bubble</li>
  </ul>
  <p>Overtrædelse kan føre til begrænsning, suspension eller sletning af adgang.</p>

  <h3><span class="tms-n">6.</span> Brugerindhold</h3>
  <p>Du er selv ansvarlig for det indhold, du opretter eller deler i Bubble, herunder:</p>
  <ul>
    <li>profiltekst</li><li>tags og interesser</li><li>opslag</li><li>chatbeskeder</li><li>filer og billeder</li><li>kommentarer og reaktioner</li><li>boblebeskrivelser</li><li>eventinformation</li>
  </ul>
  <p>Du må kun dele indhold, du har ret til at dele.</p>
  <p>Ved at dele indhold i Bubble giver du Bubble ret til teknisk at behandle, gemme, vise og distribuere indholdet i det omfang, det er nødvendigt for at levere tjenesten til dig og andre relevante brugere.</p>
  <p>Du beholder som udgangspunkt rettighederne til dit eget indhold.</p>

  <h3><span class="tms-n">7.</span> Bobler, adgangsniveauer og synlighed</h3>
  <p>Bubble bruger "bobler" som digitale rum for netværk, events, communities eller grupper.</p>
  <p>Bobler kan have forskellige adgangsniveauer. Den konkrete funktionalitet kan ændre sig i beta, men den grundlæggende forståelse er:</p>
  <h4>Offentlig boble</h4>
  <p>En offentlig boble kan være synlig for andre brugere. Andre brugere kan som udgangspunkt se basisinformation om boblen og eventuelt deltage afhængigt af bobletype og indstillinger.</p>
  <h4>Privat boble</h4>
  <p>En privat boble kan være synlig som et fællesskab eller event, men deltagelse kan kræve godkendelse, invitation eller check-in.</p>
  <h4>Skjult boble</h4>
  <p>En skjult boble er ikke beregnet til almindelig synlighed eller søgning. Adgang sker typisk via invitation, QR-kode, direkte link, medlemskab eller anden kontrolleret adgang.</p>
  <h4>Medlemskab og roller</h4>
  <p>En boble kan have roller som ejer, administrator og medlem. Ejere og administratorer kan have særlige rettigheder, fx til at redigere boblen, scanne deltagere ind, administrere medlemmer eller se visse oplysninger om aktivitet.</p>
  <p>Bubble arbejder løbende på at sikre, at adgangsniveauer håndhæves både i brugergrænsefladen og teknisk i databasen.</p>

  <h3><span class="tms-n">8.</span> Hvilke personoplysninger behandler Bubble?</h3>
  <p>Bubble behandler de oplysninger, du selv opretter, deler eller genererer gennem din brug af tjenesten. Det kan omfatte:</p>
  <h4>Konto- og loginoplysninger</h4>
  <ul><li>bruger-id</li><li>emailadresse</li><li>loginmetode</li><li>tekniske login-tokens</li><li>tidspunkt for oprettelse og seneste login</li></ul>
  <h4>Profiloplysninger</h4>
  <ul><li>navn</li><li>titel</li><li>arbejdsplads</li><li>bio</li><li>profilbillede/avatar</li><li>interesser</li><li>tags/nøgleord</li><li>branche, sektor eller fagområde</li><li>LinkedIn-link, hvis du selv tilføjer det</li><li>sprog- og app-præferencer</li></ul>
  <h4>Boble- og eventoplysninger</h4>
  <ul><li>hvilke bobler du er medlem af</li><li>hvilke events du deltager i</li><li>check-ins</li><li>roller i bobler</li><li>invitationer</li><li>scanninger eller QR-relaterede hændelser</li><li>bobler du opretter, administrerer eller gemmer</li></ul>
  <h4>Kommunikationsdata</h4>
  <ul><li>chatbeskeder</li><li>boblebeskeder</li><li>opslag</li><li>kommentarer</li><li>reaktioner</li><li>redigeringshistorik, hvis funktionen er aktiveret</li><li>filer og billeder du uploader</li></ul>
  <h4>Netværks- og relationelle data</h4>
  <ul><li>gemte kontakter</li><li>blokerede brugere</li><li>profilvisninger</li><li>kontakt- eller bobleinteraktioner</li><li>fælles bobler, interesser eller relationelle signaler, der bruges til relevans/match</li></ul>
  <h4>Tekniske data</h4>
  <ul><li>enheds- og browserinformation</li><li>fejlrapporter</li><li>logdata</li><li>IP-adresse i tekniske logs</li><li>push-subscription tokens, hvis du aktiverer push-notifikationer</li><li>lokal app-state i din browser</li></ul>
  <h4>Feedback og support</h4>
  <ul><li>beskeder du sender til Bubble</li><li>fejlrapporter</li><li>supporthenvendelser</li><li>feedback om betaen</li></ul>

  <h3><span class="tms-n">9.</span> Følsomme oplysninger</h3>
  <p>Bubble er ikke beregnet til behandling af følsomme personoplysninger. Du bør ikke dele oplysninger om fx:</p>
  <ul><li>helbred</li><li>religion</li><li>politisk overbevisning</li><li>fagforeningsforhold</li><li>seksuelle forhold eller orientering</li><li>CPR-nummer</li><li>strafbare forhold</li><li>fortrolige forretningshemmeligheder</li><li>adgangskoder eller sikkerhedsoplysninger</li></ul>
  <p>Hvis du alligevel deler sådanne oplysninger i Bubble, sker det på eget ansvar og kan blive fjernet, hvis vi bliver opmærksomme på det.</p>

  <h3><span class="tms-n">10.</span> Formål med behandlingen</h3>
  <p>Bubble behandler personoplysninger for at:</p>
  <ul><li>oprette og administrere din konto</li><li>vise din profil for relevante brugere</li><li>gøre det muligt at finde personer, bobler og events</li><li>beregne relevans, match og fælles interesser</li><li>give adgang til bobler, events og chats</li><li>muliggøre beskeder, opslag, reaktioner og filer</li><li>administrere invitationer, QR-koder og check-ins</li><li>sende relevante notifikationer, hvis du har tilladt det</li><li>sikre platformens funktion, stabilitet og sikkerhed</li><li>forebygge misbrug, spam og uautoriseret adgang</li><li>yde support og håndtere fejl</li><li>forbedre Bubble i beta-perioden</li><li>opfylde juridiske forpligtelser og besvare GDPR-anmodninger</li></ul>

  <h3><span class="tms-n">11.</span> Retsgrundlag</h3>
  <p>Bubble behandler personoplysninger på følgende grundlag:</p>
  <h4>Nødvendig behandling for at levere tjenesten</h4>
  <p>Mange oplysninger behandles, fordi det er nødvendigt for at levere Bubble til dig. Det gælder fx konto, profil, boblemedlemskab, beskeder, adgangsstyring og appfunktionalitet.</p>
  <h4>Samtykke</h4>
  <p>I visse tilfælde behandler Bubble oplysninger på baggrund af dit samtykke, fx:</p>
  <ul><li>push-notifikationer</li><li>adgang til visse enhedsfunktioner, hvis relevant</li><li>valgfri profiloplysninger</li><li>eventuelle fremtidige lokationsfunktioner, hvis de aktiveres</li></ul>
  <p>Du kan til enhver tid trække samtykke tilbage, hvor behandlingen er baseret på samtykke.</p>
  <h4>Legitim interesse</h4>
  <p>Bubble kan behandle oplysninger på baggrund af legitim interesse, fx for at drive og forbedre betaen, beskytte platformen mod misbrug, føre tekniske logs, fejlfinde, administrere sikkerhed, analysere overordnet brug i begrænset omfang uden tracking-markedsføring samt håndtere support og feedback.</p>
  <h4>Retlig forpligtelse</h4>
  <p>Bubble kan behandle oplysninger, hvis det er nødvendigt for at overholde lovgivning, dokumentere rettigheder eller håndtere myndighedshenvendelser.</p>

  <h3><span class="tms-n">12.</span> Synlighed for andre brugere</h3>
  <p>Bubble er en networking-platform. Det betyder, at visse oplysninger er beregnet til at være synlige for andre brugere. Afhængigt af dine indstillinger og kontekst kan andre brugere se:</p>
  <ul><li>dit navn</li><li>titel</li><li>arbejdsplads</li><li>profilbillede</li><li>bio</li><li>tags og interesser</li><li>fælles bobler</li><li>medlemskab af visse bobler</li><li>opslag, beskeder og reaktioner i bobler, hvor de har adgang</li><li>check-in eller deltagelse i events, hvis funktionen bruges</li></ul>
  <p>Private beskeder, boble-chat og skjulte/private bobler bør kun være synlige for brugere med relevant adgang. Bubble arbejder løbende på at styrke adgangskontrol og sikkerhed, særligt i beta-perioden.</p>

  <h3><span class="tms-n">13.</span> Anonymitet og synlighedsfunktioner</h3>
  <p>Bubble kan indeholde funktioner, hvor du kan begrænse din synlighed eller optræde mere anonymt i visse sammenhænge.</p>
  <p>Hvis du aktiverer anonymitet eller begrænset synlighed, forsøger Bubble at begrænse din fremtræden i relevante visninger. Visse tekniske data og nødvendige relationer kan dog stadig behandles for at få appen til at fungere, fx login, sikkerhed, medlemskab og adgangskontrol.</p>
  <p>Anonymitet i brugerfladen betyder ikke nødvendigvis, at alle tekniske spor om din brug straks slettes.</p>

  <h3><span class="tms-n">14.</span> Beskeder, chats og opslag</h3>
  <p>Bubble giver mulighed for kommunikation mellem brugere, fx via direkte beskeder, boble-chat, opslag, kommentarer, reaktioner og filer.</p>
  <p>Indholdet vises for de brugere, der har adgang til den pågældende samtale, boble eller funktion.</p>
  <p>Du bør ikke skrive noget i Bubble, som er fortroligt, følsomt eller kritisk. Dette gælder særligt i beta-perioden.</p>
  <p>Bubble kan teknisk behandle beskeder og opslag for at vise dem i appen, gemme dem, synkronisere dem mellem enheder, håndtere redigeringer, administrere adgang samt fejlfinde og sikre tjenesten.</p>
  <p>Bubble læser ikke dine private beskeder med henblik på reklame eller videresalg.</p>

  <h3><span class="tms-n">15.</span> Filer og profilbilleder</h3>
  <p>Hvis du uploader filer, billeder eller profilbilleder, behandles de teknisk for at gøre dem tilgængelige i Bubble. Du må ikke uploade:</p>
  <ul><li>ulovligt indhold</li><li>krænkende materiale</li><li>fortrolige dokumenter uden ret til at dele dem</li><li>personfølsomme oplysninger</li><li>malware eller skadelige filer</li></ul>
  <p>Visse filer kan være tilgængelige via tekniske fil-links. Del derfor ikke filer i Bubble, hvis de kræver høj fortrolighed.</p>

  <h3><span class="tms-n">16.</span> QR-koder, check-ins og events</h3>
  <p>Bubble kan bruge QR-koder, tokens og check-ins til at knytte brugere til events, bobler eller personer. QR- og check-in-funktioner kan bruges til:</p>
  <ul><li>at bekræfte deltagelse</li><li>at give adgang til en event-boble</li><li>at registrere fysisk eller kontekstuel tilstedeværelse</li><li>at hjælpe arrangører med at administrere deltagere</li></ul>
  <p>QR-koder og tokens skal behandles som adgangsinformation. Du bør ikke dele personlige QR-koder offentligt, medmindre det er tilsigtet.</p>

  <h3><span class="tms-n">17.</span> Push-notifikationer</h3>
  <p>Hvis du giver tilladelse til det, kan Bubble sende push-notifikationer om fx:</p>
  <ul><li>nye beskeder</li><li>invitationer</li><li>aktivitet i bobler</li><li>check-ins</li><li>relevante events eller fællesskaber</li></ul>
  <p>Du kan slå push-notifikationer fra i din browser/enhed og eventuelt i Bubble, hvis funktionen er tilgængelig.</p>
  <p>Push-notifikationer kan kræve teknisk behandling af en push-subscription token, som bruges til at sende notifikationer til din enhed.</p>

  <h3><span class="tms-n">18.</span> Cookies og lokal lagring</h3>
  <p>Bubble bruger ikke tracking-cookies og ikke tredjeparts-reklamesporing. Bubble bruger nødvendig lokal lagring for at få appen til at fungere:</p>
  <h4>Login-token</h4>
  <p>Supabase kan gemme et login-token i browserens localStorage, så du kan forblive logget ind.</p>
  <h4>App-præferencer</h4>
  <p>Bubble kan gemme lokale præferencer som fx seneste visning, sprogvalg, velkomstflow og midlertidige UI-valg.</p>
  <h4>Midlertidig navigationsstate</h4>
  <p>Bubble kan gemme midlertidig flow- og navigationsdata lokalt i browseren, fx for at huske, hvilken boble, invitation eller QR-flow du var på vej ind i.</p>
  <h4>Tekniske sikkerhedscookies</h4>
  <p>Hosting- eller sikkerhedsleverandører kan sætte teknisk nødvendige cookies. De bruges ikke til reklame eller tracking på tværs af websites.</p>

  <h3><span class="tms-n">19.</span> Analyse og tracking</h3>
  <p>Bubble bruger ikke tredjeparts-reklameanalyse og sælger ikke dine data.</p>
  <p>Bubble kan behandle begrænsede tekniske oplysninger og fejlrapporter for at forstå, om appen fungerer, finde fejl og forbedre betaen.</p>
  <p>Hvis egentlig produktanalyse, statistik eller tracking indføres senere, vil denne politik blive opdateret.</p>

  <h3><span class="tms-n">20.</span> Login via tredjepart</h3>
  <p>Bubble kan tilbyde login via eksterne loginudbydere, fx Google eller LinkedIn. Hvis du bruger en ekstern loginudbyder, kan Bubble modtage oplysninger som:</p>
  <ul><li>navn</li><li>email</li><li>profilbillede</li><li>login-id</li><li>eventuelle øvrige oplysninger, som udbyderen stiller til rådighed, og som du accepterer</li></ul>
  <p>Den eksterne udbyder behandler også oplysninger efter egne vilkår og privatlivspolitikker.</p>
  <p>Bubble bruger oplysningerne til at oprette og administrere din konto og gøre onboarding lettere.</p>

  <h3><span class="tms-n">21.</span> Underleverandører og databehandlere</h3>
  <p>Bubble bruger tekniske underleverandører til at drive tjenesten. Det kan omfatte leverandører til database, login/authentication, hosting, filopbevaring, push-notifikationer, email, fejlrapportering samt udvikling og drift.</p>
  <p>Bubble deler kun personoplysninger med underleverandører, når det er nødvendigt for at levere, sikre eller forbedre tjenesten.</p>
  <p>Bubble sælger ikke personoplysninger og videregiver ikke personoplysninger til tredjepart med henblik på markedsføring.</p>
  <p>Hvis underleverandører behandler oplysninger uden for EU/EØS, skal det ske under passende databeskyttelsesgarantier, fx standardkontraktbestemmelser, tilstrækkelighedsafgørelser eller andre relevante mekanismer.</p>

  <h3><span class="tms-n">22.</span> Hvor opbevares oplysninger?</h3>
  <p>Bubble bestræber sig på at behandle og opbevare personoplysninger inden for EU/EØS, hvor det er muligt.</p>
  <p>Visse tekniske underleverandører kan dog behandle oplysninger uden for EU/EØS, hvis det er nødvendigt for at levere tjenesten, og hvis der anvendes passende databeskyttelsesgarantier.</p>

  <h3><span class="tms-n">23.</span> Hvor længe opbevares oplysninger?</h3>
  <p>Bubble opbevarer oplysninger, så længe det er nødvendigt for at levere tjenesten, administrere din konto, opfylde formålene i denne politik eller overholde lovgivning. Som udgangspunkt gælder:</p>
  <ul><li>konto- og profiloplysninger opbevares, så længe du har en aktiv konto</li><li>beskeder, opslag og bobleindhold opbevares, så længe det er nødvendigt for boblen eller samtalen</li><li>tekniske logs opbevares kun så længe, det er nødvendigt for drift, sikkerhed og fejlretning</li><li>supporthenvendelser opbevares så længe, det er nødvendigt for at håndtere henvendelsen og dokumentere forløbet</li><li>slettede brugeres oplysninger slettes eller anonymiseres i det omfang, det er teknisk og juridisk muligt</li></ul>
  <p>Ved sletning af en bruger kan visse indlæg eller beskeder bevares i anonymiseret form, hvis de indgår i fælles kontekst, boblehistorik eller samtaler. I så fald fjernes eller anonymiseres koblingen til den slettede bruger.</p>

  <h3><span class="tms-n">24.</span> Sletning af konto og data</h3>
  <p>Du kan anmode om at få dine personoplysninger slettet ved at kontakte <span class="tms-email"></span>. Ved en sletningsanmodning vil Bubble som udgangspunkt:</p>
  <ul><li>slette eller anonymisere din profil</li><li>slette eller anonymisere relevante relationer til bobler</li><li>slette eller anonymisere dine personlige filer, hvor det er muligt</li><li>fjerne eller anonymisere tekniske koblinger til din bruger</li><li>slette eller anonymisere relationer såsom gemte kontakter, blokeringer og profilvisninger, hvor relevant</li><li>håndtere beskeder og opslag efter en konkret teknisk og praktisk vurdering</li></ul>
  <p>Nogle oplysninger kan bevares i anonymiseret form, hvis de ikke længere kan knyttes til dig som person.</p>
  <p>Nogle oplysninger kan også bevares, hvis det er nødvendigt for at overholde lovgivning, dokumentere rettigheder, håndtere sikkerhedshændelser eller beskytte mod misbrug.</p>

  <h3><span class="tms-n">25.</span> Dine rettigheder</h3>
  <p>Du har efter GDPR en række rettigheder. Du har ret til:</p>
  <ul><li>indsigt i de oplysninger, Bubble behandler om dig</li><li>berigtigelse af urigtige oplysninger</li><li>sletning af oplysninger i visse tilfælde</li><li>begrænsning af behandling i visse tilfælde</li><li>dataportabilitet i visse tilfælde</li><li>indsigelse mod behandling i visse tilfælde</li><li>at trække samtykke tilbage, hvor behandlingen er baseret på samtykke</li></ul>
  <p>Du kan udøve dine rettigheder ved at kontakte <span class="tms-email"></span>.</p>
  <p>Bubble svarer som udgangspunkt inden for 30 dage. Hvis en anmodning er kompleks, kan det tage længere tid, men du vil i så fald blive informeret.</p>
  <p>Du kan også selv redigere visse oplysninger direkte i appen, fx profiloplysninger og præferencer.</p>

  <h3><span class="tms-n">26.</span> Blokering og sikkerhed</h3>
  <p>Du kan blokere andre brugere i Bubble, hvis funktionen er tilgængelig.</p>
  <p>Bubble kan også begrænse, suspendere eller slette brugere, profiler, bobler eller indhold, hvis der er mistanke om misbrug, spam, chikane, sikkerhedsbrud, forsøg på rettighedsomgåelse, ulovligt indhold eller overtrædelse af disse vilkår.</p>
  <p>Bubble kan foretage tekniske og organisatoriske sikkerhedsforanstaltninger for at beskytte platformen, herunder adgangskontrol, databasepolitikker, fejlmonitorering og begrænsning af rettigheder.</p>

  <h3><span class="tms-n">27.</span> Sikkerhedsbrud</h3>
  <p>Hvis Bubble bliver opmærksom på et sikkerhedsbrud, der kan indebære risiko for dine rettigheder eller frihedsrettigheder, vil Bubble håndtere dette efter gældende regler. Det kan omfatte:</p>
  <ul><li>teknisk afhjælpning</li><li>vurdering af risiko</li><li>dokumentation</li><li>underretning til relevante brugere, hvis nødvendigt</li><li>anmeldelse til Datatilsynet, hvis påkrævet</li></ul>

  <h3><span class="tms-n">28.</span> Ændringer i vilkår og privatlivspolitik</h3>
  <p>Bubble kan ændre disse vilkår og denne privatlivspolitik. Ændringer kan ske som følge af nye funktioner, ændringer i databehandling, ændringer i underleverandører, juridiske krav, sikkerhedsforbedringer eller overgang fra beta til bredere lancering.</p>
  <p>Ved væsentlige ændringer vil Bubble forsøge at informere brugerne tydeligt, fx i appen eller via email.</p>
  <p>Den nyeste version vil altid være tilgængelig i appen eller på Bubbles hjemmeside.</p>

  <h3><span class="tms-n">29.</span> Betalte, verificerede eller professionelle bobler</h3>
  <p>Bubble kan i fremtiden tilbyde betalte, verificerede eller professionelle bobler til fx netværk, events, virksomheder, foreninger eller communities. Hvis sådanne funktioner aktiveres, kan der gælde særskilte vilkår for:</p>
  <ul><li>betaling</li><li>fakturering</li><li>verificering</li><li>adgangsrettigheder</li><li>administratorroller</li><li>deltagerlister</li><li>eksport</li><li>statistik</li><li>support</li><li>opsigelse</li></ul>
  <p>Sådanne vilkår vil blive oplyst særskilt, inden en boble eller organisation tilmelder sig en betalt ordning.</p>

  <h3><span class="tms-n">30.</span> Ansvarsfraskrivelse</h3>
  <p>Bubble leveres i beta "as is". Bubble giver ingen garanti for:</p>
  <ul><li>uafbrudt adgang</li><li>fejlfri funktion</li><li>at alle data bevares</li><li>at alle matches eller anbefalinger er relevante</li><li>at relationer, møder eller samarbejder skabt via Bubble får et bestemt resultat</li><li>at tredjepartsintegrationer altid fungerer</li></ul>
  <p>Bubble er ikke ansvarlig for:</p>
  <ul><li>handlinger foretaget af andre brugere</li><li>indhold delt af andre brugere</li><li>tab som følge af brug af beta-platformen</li><li>tab af data under beta, medmindre andet følger af ufravigelig lovgivning</li><li>beslutninger truffet på baggrund af information i Bubble</li><li>fejl, nedetid eller ændringer i tredjepartsleverandører</li></ul>
  <p>Brug af Bubble sker på eget ansvar.</p>

  <h3><span class="tms-n">31.</span> Ophør og adgangsbegrænsning</h3>
  <p>Du kan stoppe med at bruge Bubble når som helst. Bubble kan begrænse eller lukke din adgang, hvis:</p>
  <ul><li>du overtræder vilkårene</li><li>du misbruger platformen</li><li>det er nødvendigt af sikkerhedshensyn</li><li>betaen ændres eller lukkes</li><li>Bubble ophører eller overgår til en anden driftsform</li></ul>
  <p>Hvis Bubble lukkes eller ændres væsentligt, vil vi forsøge at informere brugerne i rimeligt omfang.</p>

  <h3><span class="tms-n">32.</span> Lovvalg</h3>
  <p>Disse vilkår er underlagt dansk ret, medmindre andet følger af ufravigelige forbruger- eller databeskyttelsesregler.</p>
  <p>Eventuelle tvister søges først løst i dialog.</p>

  <h3><span class="tms-n">33.</span> Klage</h3>
  <p>Hvis du er utilfreds med Bubbles behandling af dine personoplysninger, kan du kontakte os på <span class="tms-email"></span>.</p>
  <p>Du kan også klage til Datatilsynet:</p>
  <p>Datatilsynet<br>Carl Jacobsens Vej 35<br>2500 Valby<br>Danmark<br><a href="https://www.datatilsynet.dk" target="_blank" rel="noopener">www.datatilsynet.dk</a></p>

  <h3><span class="tms-n">34.</span> Kort opsummering</h3>
  <p>Bubble er en beta-platform til networking, bobler og events. Vi behandler de oplysninger, du giver os, og de oplysninger der skabes gennem din brug af appen, for at kunne levere tjenesten. Vi sælger ikke dine data, bruger ikke tracking-cookies og bruger ikke dine oplysninger til reklameformål. Du bør ikke dele følsomme eller fortrolige oplysninger i Bubble. Du kan kontakte <span class="tms-email"></span> for indsigt, rettelse eller sletning.</p>

  <p class="tms-meta">© 2026 Bubble · Vilkår & Privatlivspolitik v1.2 · Juni 2026</p>
</div>
`;

var TERMS_EN = `
<div class="tms-body">
  <p class="tms-intro">Version 1.2 · Last updated: June 2026</p>
  <p>This document describes the terms for using Bubble and how Bubble processes personal data. Bubble is in beta, and this document may be updated as the service develops.</p>

  <h3><span class="tms-n">1.</span> What is Bubble?</h3>
  <p>Bubble is a networking platform developed in Sønderborg, Denmark. Bubble helps users find relevant people, bubbles, events and professional communities based on profile information, interests, relationships, participation in bubbles/events and contextual relevance.</p>
  <p>Bubble is specifically built for professional networks, local communities, events, conferences, companies, associations and professional environments where people need a digital space around a physical or professional community.</p>
  <p>Bubble is currently in beta. This means the platform is still being tested, improved and changed.</p>

  <h3><span class="tms-n">2.</span> Data controller and contact</h3>
  <p>The data controller for the processing of personal data in connection with Bubble is:</p>
  <p>Michael Sørensen<br>Sønderborg, Denmark<br>Contact: <span class="tms-email"></span></p>
  <p>If Bubble is later operated through a company, association or other legal entity, this information will be updated.</p>

  <h3><span class="tms-n">3.</span> Acceptance of terms</h3>
  <p>By creating an account, logging in or using Bubble, you accept these terms and this privacy policy.</p>
  <p>If you cannot accept the terms, you must refrain from using Bubble.</p>
  <p>Bubble is intended for adult and professional users. The platform is not directed at children.</p>

  <h3><span class="tms-n">4.</span> Beta disclaimer</h3>
  <p>Bubble is in beta. This means that:</p>
  <ul>
    <li>features may change, be added or removed without notice</li>
    <li>bugs, downtime, missing functionality or data loss may occur</li>
    <li>the user experience may change continuously</li>
    <li>data and the test environment may be cleaned up, changed or reset as part of development</li>
    <li>no guarantee is given for uptime, full data integrity or uninterrupted access</li>
  </ul>
  <p>We do our best to operate Bubble safely and responsibly, but Bubble is provided in beta "as is".</p>
  <p>You should not use Bubble for critical communication, confidential business information, sensitive personal data or information that must not be lost.</p>

  <h3><span class="tms-n">5.</span> What you may use Bubble for</h3>
  <p>You may use Bubble to:</p>
  <ul>
    <li>create and maintain a professional profile</li>
    <li>find relevant people, bubbles, networks and events</li>
    <li>participate in bubbles and events</li>
    <li>communicate with other users</li>
    <li>save contacts and relevant relationships</li>
    <li>create bubbles, if the feature is available to you</li>
    <li>administer bubbles/events, if you are an owner or administrator</li>
    <li>test and give feedback on the platform</li>
  </ul>
  <p>You may not use Bubble for:</p>
  <ul>
    <li>spam, harassment, stalking or unwanted contact</li>
    <li>hateful, threatening, discriminatory or unlawful content</li>
    <li>deception, impersonation or fake profiles</li>
    <li>sharing sensitive or confidential information without a relevant basis</li>
    <li>attempts to circumvent access control, security or rights</li>
    <li>scraping, bulk extraction or automated collection of user data</li>
    <li>uploading harmful files, malware or unlawful material</li>
    <li>commercial exploitation without an agreement with Bubble</li>
  </ul>
  <p>Violation may lead to restriction, suspension or deletion of access.</p>

  <h3><span class="tms-n">6.</span> User content</h3>
  <p>You are responsible for the content you create or share in Bubble, including:</p>
  <ul>
    <li>profile text</li><li>tags and interests</li><li>posts</li><li>chat messages</li><li>files and images</li><li>comments and reactions</li><li>bubble descriptions</li><li>event information</li>
  </ul>
  <p>You may only share content you have the right to share.</p>
  <p>By sharing content in Bubble, you grant Bubble the right to technically process, store, display and distribute the content to the extent necessary to provide the service to you and other relevant users.</p>
  <p>You generally retain the rights to your own content.</p>

  <h3><span class="tms-n">7.</span> Bubbles, access levels and visibility</h3>
  <p>Bubble uses "bubbles" as digital spaces for networks, events, communities or groups.</p>
  <p>Bubbles can have different access levels. The specific functionality may change in beta, but the basic understanding is:</p>
  <h4>Public bubble</h4>
  <p>A public bubble may be visible to other users. Other users can generally see basic information about the bubble and may participate depending on the bubble type and settings.</p>
  <h4>Private bubble</h4>
  <p>A private bubble may be visible as a community or event, but participation may require approval, invitation or check-in.</p>
  <h4>Hidden bubble</h4>
  <p>A hidden bubble is not intended for general visibility or search. Access typically happens via invitation, QR code, direct link, membership or other controlled access.</p>
  <h4>Membership and roles</h4>
  <p>A bubble can have roles such as owner, administrator and member. Owners and administrators may have special rights, for example to edit the bubble, check participants in, manage members or see certain information about activity.</p>
  <p>Bubble continuously works to ensure that access levels are enforced both in the user interface and technically in the database.</p>

  <h3><span class="tms-n">8.</span> What personal data does Bubble process?</h3>
  <p>Bubble processes the information you create, share or generate through your use of the service. This may include:</p>
  <h4>Account and login information</h4>
  <ul><li>user ID</li><li>email address</li><li>login method</li><li>technical login tokens</li><li>time of creation and most recent login</li></ul>
  <h4>Profile information</h4>
  <ul><li>name</li><li>title</li><li>workplace</li><li>bio</li><li>profile picture/avatar</li><li>interests</li><li>tags/keywords</li><li>industry, sector or professional area</li><li>LinkedIn link, if you add it yourself</li><li>language and app preferences</li></ul>
  <h4>Bubble and event information</h4>
  <ul><li>which bubbles you are a member of</li><li>which events you participate in</li><li>check-ins</li><li>roles in bubbles</li><li>invitations</li><li>scans or QR-related events</li><li>bubbles you create, administer or save</li></ul>
  <h4>Communication data</h4>
  <ul><li>chat messages</li><li>bubble messages</li><li>posts</li><li>comments</li><li>reactions</li><li>edit history, if the feature is enabled</li><li>files and images you upload</li></ul>
  <h4>Network and relational data</h4>
  <ul><li>saved contacts</li><li>blocked users</li><li>profile views</li><li>contact or bubble interactions</li><li>shared bubbles, interests or relational signals used for relevance/matching</li></ul>
  <h4>Technical data</h4>
  <ul><li>device and browser information</li><li>error reports</li><li>log data</li><li>IP address in technical logs</li><li>push subscription tokens, if you enable push notifications</li><li>local app state in your browser</li></ul>
  <h4>Feedback and support</h4>
  <ul><li>messages you send to Bubble</li><li>error reports</li><li>support enquiries</li><li>feedback about the beta</li></ul>

  <h3><span class="tms-n">9.</span> Sensitive information</h3>
  <p>Bubble is not intended for the processing of sensitive personal data. You should not share information about, for example:</p>
  <ul><li>health</li><li>religion</li><li>political beliefs</li><li>trade union membership</li><li>sexual relationships or orientation</li><li>national ID number</li><li>criminal matters</li><li>confidential trade secrets</li><li>passwords or security information</li></ul>
  <p>If you do share such information in Bubble, it is at your own risk and it may be removed if we become aware of it.</p>

  <h3><span class="tms-n">10.</span> Purpose of processing</h3>
  <p>Bubble processes personal data in order to:</p>
  <ul><li>create and administer your account</li><li>show your profile to relevant users</li><li>make it possible to find people, bubbles and events</li><li>calculate relevance, matches and shared interests</li><li>give access to bubbles, events and chats</li><li>enable messages, posts, reactions and files</li><li>administer invitations, QR codes and check-ins</li><li>send relevant notifications, if you have allowed it</li><li>ensure the platform's function, stability and security</li><li>prevent misuse, spam and unauthorised access</li><li>provide support and handle errors</li><li>improve Bubble during the beta period</li><li>fulfil legal obligations and respond to GDPR requests</li></ul>

  <h3><span class="tms-n">11.</span> Legal basis</h3>
  <p>Bubble processes personal data on the following basis:</p>
  <h4>Processing necessary to provide the service</h4>
  <p>Much information is processed because it is necessary to provide Bubble to you. This includes, for example, account, profile, bubble membership, messages, access control and app functionality.</p>
  <h4>Consent</h4>
  <p>In certain cases Bubble processes information based on your consent, for example:</p>
  <ul><li>push notifications</li><li>access to certain device features, where relevant</li><li>optional profile information</li><li>any future location features, if enabled</li></ul>
  <p>You can withdraw your consent at any time where processing is based on consent.</p>
  <h4>Legitimate interest</h4>
  <p>Bubble may process information on the basis of legitimate interest, for example to operate and improve the beta, protect the platform against misuse, keep technical logs, debug, manage security, analyse overall usage to a limited extent without tracking-based marketing, and handle support and feedback.</p>
  <h4>Legal obligation</h4>
  <p>Bubble may process information where necessary to comply with legislation, document rights or handle requests from authorities.</p>

  <h3><span class="tms-n">12.</span> Visibility to other users</h3>
  <p>Bubble is a networking platform. This means certain information is intended to be visible to other users. Depending on your settings and context, other users may see:</p>
  <ul><li>your name</li><li>title</li><li>workplace</li><li>profile picture</li><li>bio</li><li>tags and interests</li><li>shared bubbles</li><li>membership of certain bubbles</li><li>posts, messages and reactions in bubbles they have access to</li><li>check-in or participation in events, if the feature is used</li></ul>
  <p>Private messages, bubble chat and hidden/private bubbles should only be visible to users with relevant access. Bubble continuously works to strengthen access control and security, especially during the beta period.</p>

  <h3><span class="tms-n">13.</span> Anonymity and visibility features</h3>
  <p>Bubble may include features where you can limit your visibility or appear more anonymously in certain contexts.</p>
  <p>If you enable anonymity or limited visibility, Bubble tries to limit your appearance in relevant views. However, certain technical data and necessary relationships may still be processed to make the app work, for example login, security, membership and access control.</p>
  <p>Anonymity in the interface does not necessarily mean that all technical traces of your use are immediately deleted.</p>

  <h3><span class="tms-n">14.</span> Messages, chats and posts</h3>
  <p>Bubble enables communication between users, for example via direct messages, bubble chat, posts, comments, reactions and files.</p>
  <p>The content is shown to the users who have access to the relevant conversation, bubble or feature.</p>
  <p>You should not write anything in Bubble that is confidential, sensitive or critical. This applies especially during the beta period.</p>
  <p>Bubble may technically process messages and posts in order to display them in the app, store them, synchronise them between devices, handle edits, manage access, and debug and secure the service.</p>
  <p>Bubble does not read your private messages for advertising or resale purposes.</p>

  <h3><span class="tms-n">15.</span> Files and profile pictures</h3>
  <p>If you upload files, images or profile pictures, they are processed technically to make them available in Bubble. You may not upload:</p>
  <ul><li>unlawful content</li><li>infringing material</li><li>confidential documents you do not have the right to share</li><li>sensitive personal data</li><li>malware or harmful files</li></ul>
  <p>Some files may be accessible via technical file links. Therefore, do not share files in Bubble if they require high confidentiality.</p>

  <h3><span class="tms-n">16.</span> QR codes, check-ins and events</h3>
  <p>Bubble may use QR codes, tokens and check-ins to link users to events, bubbles or people. QR and check-in features can be used to:</p>
  <ul><li>confirm participation</li><li>give access to an event bubble</li><li>register physical or contextual presence</li><li>help organisers manage participants</li></ul>
  <p>QR codes and tokens should be treated as access information. You should not share personal QR codes publicly unless it is intended.</p>

  <h3><span class="tms-n">17.</span> Push notifications</h3>
  <p>If you grant permission, Bubble may send push notifications about, for example:</p>
  <ul><li>new messages</li><li>invitations</li><li>activity in bubbles</li><li>check-ins</li><li>relevant events or communities</li></ul>
  <p>You can turn off push notifications in your browser/device and, if the feature is available, in Bubble.</p>
  <p>Push notifications may require technical processing of a push subscription token used to send notifications to your device.</p>

  <h3><span class="tms-n">18.</span> Cookies and local storage</h3>
  <p>Bubble does not use tracking cookies or third-party advertising tracking. Bubble uses necessary local storage to make the app work:</p>
  <h4>Login token</h4>
  <p>Supabase may store a login token in the browser's localStorage so you can stay logged in.</p>
  <h4>App preferences</h4>
  <p>Bubble may store local preferences such as last view, language choice, welcome flow and temporary UI choices.</p>
  <h4>Temporary navigation state</h4>
  <p>Bubble may store temporary flow and navigation data locally in the browser, for example to remember which bubble, invitation or QR flow you were entering.</p>
  <h4>Technical security cookies</h4>
  <p>Hosting or security providers may set technically necessary cookies. They are not used for advertising or cross-site tracking.</p>

  <h3><span class="tms-n">19.</span> Analytics and tracking</h3>
  <p>Bubble does not use third-party advertising analytics and does not sell your data.</p>
  <p>Bubble may process limited technical information and error reports to understand whether the app works, find bugs and improve the beta.</p>
  <p>If actual product analytics, statistics or tracking are introduced later, this policy will be updated.</p>

  <h3><span class="tms-n">20.</span> Login via third parties</h3>
  <p>Bubble may offer login via external login providers, for example Google or LinkedIn. If you use an external login provider, Bubble may receive information such as:</p>
  <ul><li>name</li><li>email</li><li>profile picture</li><li>login ID</li><li>any other information the provider makes available and that you accept</li></ul>
  <p>The external provider also processes information under its own terms and privacy policies.</p>
  <p>Bubble uses the information to create and administer your account and make onboarding easier.</p>

  <h3><span class="tms-n">21.</span> Sub-processors and data processors</h3>
  <p>Bubble uses technical sub-processors to operate the service. This may include providers for database, login/authentication, hosting, file storage, push notifications, email, error reporting, and development and operations.</p>
  <p>Bubble only shares personal data with sub-processors when it is necessary to provide, secure or improve the service.</p>
  <p>Bubble does not sell personal data and does not pass personal data to third parties for marketing purposes.</p>
  <p>If sub-processors process information outside the EU/EEA, it must take place under appropriate data protection safeguards, for example standard contractual clauses, adequacy decisions or other relevant mechanisms.</p>

  <h3><span class="tms-n">22.</span> Where is information stored?</h3>
  <p>Bubble strives to process and store personal data within the EU/EEA where possible.</p>
  <p>However, certain technical sub-processors may process information outside the EU/EEA if it is necessary to provide the service and if appropriate data protection safeguards are used.</p>

  <h3><span class="tms-n">23.</span> How long is information stored?</h3>
  <p>Bubble stores information for as long as it is necessary to provide the service, administer your account, fulfil the purposes in this policy or comply with legislation. As a general rule:</p>
  <ul><li>account and profile information is stored for as long as you have an active account</li><li>messages, posts and bubble content are stored for as long as necessary for the bubble or conversation</li><li>technical logs are stored only for as long as necessary for operation, security and debugging</li><li>support enquiries are stored for as long as necessary to handle the enquiry and document the process</li><li>deleted users' information is deleted or anonymised to the extent technically and legally possible</li></ul>
  <p>When a user is deleted, certain posts or messages may be retained in anonymised form if they form part of shared context, bubble history or conversations. In that case the link to the deleted user is removed or anonymised.</p>

  <h3><span class="tms-n">24.</span> Deletion of account and data</h3>
  <p>You can request deletion of your personal data by contacting <span class="tms-email"></span>. Upon a deletion request, Bubble will generally:</p>
  <ul><li>delete or anonymise your profile</li><li>delete or anonymise relevant relationships to bubbles</li><li>delete or anonymise your personal files where possible</li><li>remove or anonymise technical links to your account</li><li>delete or anonymise relationships such as saved contacts, blocks and profile views, where relevant</li><li>handle messages and posts based on a specific technical and practical assessment</li></ul>
  <p>Some information may be retained in anonymised form if it can no longer be linked to you as a person.</p>
  <p>Some information may also be retained if it is necessary to comply with legislation, document rights, handle security incidents or protect against misuse.</p>

  <h3><span class="tms-n">25.</span> Your rights</h3>
  <p>Under GDPR you have a number of rights. You have the right to:</p>
  <ul><li>access to the information Bubble processes about you</li><li>rectification of inaccurate information</li><li>erasure of information in certain cases</li><li>restriction of processing in certain cases</li><li>data portability in certain cases</li><li>objection to processing in certain cases</li><li>withdraw consent where processing is based on consent</li></ul>
  <p>You can exercise your rights by contacting <span class="tms-email"></span>.</p>
  <p>Bubble generally responds within 30 days. If a request is complex, it may take longer, but you will be informed in that case.</p>
  <p>You can also edit certain information directly in the app yourself, for example profile information and preferences.</p>

  <h3><span class="tms-n">26.</span> Blocking and security</h3>
  <p>You can block other users in Bubble, if the feature is available.</p>
  <p>Bubble may also restrict, suspend or delete users, profiles, bubbles or content if there is suspicion of misuse, spam, harassment, security breach, attempts to circumvent rights, unlawful content or violation of these terms.</p>
  <p>Bubble may take technical and organisational security measures to protect the platform, including access control, database policies, error monitoring and restriction of rights.</p>

  <h3><span class="tms-n">27.</span> Security breaches</h3>
  <p>If Bubble becomes aware of a security breach that may pose a risk to your rights or freedoms, Bubble will handle it in accordance with applicable rules. This may include:</p>
  <ul><li>technical remediation</li><li>risk assessment</li><li>documentation</li><li>notification of relevant users, if necessary</li><li>reporting to the Danish Data Protection Agency, if required</li></ul>

  <h3><span class="tms-n">28.</span> Changes to terms and privacy policy</h3>
  <p>Bubble may change these terms and this privacy policy. Changes may occur as a result of new features, changes in data processing, changes in sub-processors, legal requirements, security improvements or the transition from beta to a wider launch.</p>
  <p>For significant changes, Bubble will try to inform users clearly, for example in the app or by email.</p>
  <p>The latest version will always be available in the app or on Bubble's website.</p>

  <h3><span class="tms-n">29.</span> Paid, verified or professional bubbles</h3>
  <p>In the future, Bubble may offer paid, verified or professional bubbles for, for example, networks, events, companies, associations or communities. If such features are enabled, separate terms may apply for:</p>
  <ul><li>payment</li><li>invoicing</li><li>verification</li><li>access rights</li><li>administrator roles</li><li>participant lists</li><li>export</li><li>statistics</li><li>support</li><li>termination</li></ul>
  <p>Such terms will be provided separately before a bubble or organisation signs up for a paid plan.</p>

  <h3><span class="tms-n">30.</span> Disclaimer</h3>
  <p>Bubble is provided in beta "as is". Bubble gives no guarantee that:</p>
  <ul><li>access is uninterrupted</li><li>the service functions without errors</li><li>all data is retained</li><li>all matches or recommendations are relevant</li><li>relationships, meetings or collaborations created via Bubble lead to a particular outcome</li><li>third-party integrations always work</li></ul>
  <p>Bubble is not responsible for:</p>
  <ul><li>actions taken by other users</li><li>content shared by other users</li><li>loss resulting from use of the beta platform</li><li>loss of data during beta, unless otherwise required by mandatory legislation</li><li>decisions made based on information in Bubble</li><li>errors, downtime or changes in third-party providers</li></ul>
  <p>Use of Bubble is at your own risk.</p>

  <h3><span class="tms-n">31.</span> Termination and access restriction</h3>
  <p>You can stop using Bubble at any time. Bubble may restrict or close your access if:</p>
  <ul><li>you violate the terms</li><li>you misuse the platform</li><li>it is necessary for security reasons</li><li>the beta is changed or closed</li><li>Bubble ceases or moves to a different form of operation</li></ul>
  <p>If Bubble is closed or significantly changed, we will try to inform users to a reasonable extent.</p>

  <h3><span class="tms-n">32.</span> Governing law</h3>
  <p>These terms are governed by Danish law, unless otherwise required by mandatory consumer or data protection rules.</p>
  <p>Any disputes are first sought resolved through dialogue.</p>

  <h3><span class="tms-n">33.</span> Complaints</h3>
  <p>If you are dissatisfied with Bubble's processing of your personal data, you can contact us at <span class="tms-email"></span>.</p>
  <p>You can also complain to the Danish Data Protection Agency (Datatilsynet):</p>
  <p>Datatilsynet<br>Carl Jacobsens Vej 35<br>2500 Valby<br>Denmark<br><a href="https://www.datatilsynet.dk" target="_blank" rel="noopener">www.datatilsynet.dk</a></p>

  <h3><span class="tms-n">34.</span> Brief summary</h3>
  <p>Bubble is a beta platform for networking, bubbles and events. We process the information you give us and the information created through your use of the app in order to provide the service. We do not sell your data, do not use tracking cookies and do not use your information for advertising purposes. You should not share sensitive or confidential information in Bubble. You can contact <span class="tms-email"></span> for access, correction or deletion.</p>

  <p class="tms-meta">© 2026 Bubble · Terms & Privacy Policy v1.2 · June 2026</p>
</div>
`;

// Populate any <span class="tms-email"></span> inside a container with the contact email.
function tmsFillEmail(container) {
  if (!container) return;
  var _t = 'in' + 'fo@' + 'bubb' + 'leme' + '.dk';
  container.querySelectorAll('.tms-email').forEach(function(el) { el.textContent = _t; });
}
