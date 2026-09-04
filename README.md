# Zwem-tickets

Simpele ticketverkoop-site: bezoekers kiezen een evenement en betalen ofwel
online via Mollie (automatische bevestiging), ofwel via een overschrijving
met QR-code (jij bevestigt handmatig in `/admin` zodra je de storting ziet).
Betaalde tickets krijgen automatisch een e-mail met QR-code. Jij ziet in
`/admin` in één oogopslag wie betaald heeft — geen handmatig gecheck meer
nodig tegen een Google Formulier.

## 1. Accounts aanmaken (eenmalig, door jou)

1. **Supabase** (database, gratis tier) — https://supabase.com
   - Maak een nieuw project aan.
   - Ga naar *SQL Editor* → *New query*, plak de inhoud van
     [`supabase/schema.sql`](supabase/schema.sql) en klik *Run*. Dit maakt de
     tabellen `events` en `orders` aan.
   - Ga naar *Project Settings → API* en noteer:
     - `Project URL` → wordt `SUPABASE_URL`
     - `service_role` key (niet de `anon` key!) → wordt `SUPABASE_SERVICE_ROLE_KEY`

2. **Mollie** (betalingen) — https://www.mollie.com/en/signup
   - Registreer de vzw met KBO-nummer en rekeningnummer.
   - Zolang je account nog niet volledig geverifieerd is, kun je al testen
     met de **test API key** (Dashboard → Developers → API keys).
   - Zodra geverifieerd: gebruik de **live API key** voor echte betalingen.
   - Wero: als Mollie Wero voor jouw account activeert, verschijnt dat
     automatisch als betaalmethode in de Mollie-checkout — geen code nodig.

3. **Resend** (bevestigingsmails) — https://resend.com
   - Gratis tier is ruim voldoende voor een paar events per maand.
   - Voeg je eigen domein toe (of gebruik voorlopig hun test-adres) en maak
     een API key aan.

4. **Vercel** (hosting, gratis tier) — https://vercel.com
   - Log in met GitHub.
   - Later (stap 4 hieronder) koppel je hier deze projectmap aan.

5. **Bankrekening(en) voor overschrijvingen (optioneel, geen account nodig)**
   - Voeg één of meerdere rekeningen toe via `/admin/settings` (label,
     rekeninghouder, IBAN, optioneel BIC) — geen aanmelding of derde partij
     nodig, dit genereert automatisch een standaard SEPA-betaal-QR-code
     (dezelfde soort als op facturen).
   - Kies per evenement (in `/admin/events`) naar welke rekening dat
     evenement moet uitbetaald worden — handig als je bv. een aparte rekening
     per afdeling hebt.
   - Pas eventueel het sjabloon voor de betaalmededeling aan (ook in
     `/admin/settings`), met plaatshouders `{nummer}`, `{evenement}`, `{naam}`.
   - Let op: hiermee krijg je **geen automatische bevestiging**. Je moet zelf
     periodiek je bankapp checken en in `/admin` op **"Markeer betaald"**
     klikken zodra je de storting ziet (herkenbaar aan de mededeling).

## 2. Lokaal instellen

```bash
cp .env.example .env.local
```

Vul `.env.local` in met de sleutels van hierboven. Genereer een willekeurige
`ADMIN_SESSION_SECRET` met bijvoorbeeld:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start de site lokaal:

```bash
npm run dev
```

Open http://localhost:3000

## 3. Een evenement toevoegen

Log in op `/admin/login`, ga naar het tabblad **Evenementen** en klik op
**"+ Nieuw evenement"**. Vul titel, datum, tijdstip, locatie, prijs en
capaciteit in — het evenement verschijnt meteen op de homepage (tenzij je
"meteen publiceren" uitvinkt). Je kan een evenement later verbergen
(niet meer verwijderen zodra er bestellingen op staan, om de geschiedenis
niet kwijt te raken).

## 4. Live zetten (Vercel)

1. Zet dit project in een git-repo (bv. GitHub, kan privé).
2. Op https://vercel.com: *New Project* → kies de repo.
3. Voeg bij *Environment Variables* dezelfde variabelen toe als in
   `.env.local`, maar met `APP_URL` = je echte Vercel/domeinnaam
   (bv. `https://tickets-mcattawassul.vercel.app`).
4. Deploy.
5. Test één volledige aankoop met de **Mollie test-modus** voor je live gaat.
6. Zodra alles werkt: zet `MOLLIE_API_KEY` om naar de live-key.

## Hoe het werkt

- `/` — lijst van komende evenementen met resterende plaatsen
- `/event/[id]` — evenement + bestelformulier, met keuze tussen Mollie en
  overschrijving (als beide beschikbaar zijn)
- `/api/checkout` — maakt de bestelling aan; start een Mollie-betaling, of
  stuurt direct door naar de ticketpagina bij overschrijving
- `/api/webhook/mollie` — Mollie roept dit aan zodra er betaald is; zet
  bestelling op "paid" en verstuurt de ticketmail
- `/ticket/[orderId]` — bevestigingspagina; toont de check-in QR bij een
  betaald ticket, of de betaal-QR + kopieerbare IBAN/bedrag/mededeling
  zolang een overschrijving nog niet bevestigd is
- `/admin` — overzicht van alle bestellingen per evenement, met CSV-export,
  een **"Markeer betaald"**-knop per openstaande overschrijving, een
  **"WhatsApp sturen"**-knop (opent jouw eigen WhatsApp met een kant-en-klaar
  bericht naar de koper, bv. om te melden dat de betaling nog niet in orde
  is — geen WhatsApp-account of API nodig), en zicht op wie al is ingecheckt
  (login met `ADMIN_PASSWORD`)
- `/admin/events` — evenementen aanmaken, publiceren/verbergen, verwijderen,
  en per evenement een bankrekening kiezen voor overschrijvingen
- `/admin/scan` — camera-scanner voor de ingang: scan de QR-code van een
  ticket en het wordt automatisch afgevinkt (met foutmelding bij een
  niet-betaald, al gebruikt, of onbekend ticket)
- `/admin/settings` — bankrekeningen beheren (toevoegen, standaard instellen,
  verwijderen) en het sjabloon voor de betaalmededeling aanpassen

## Voorkomen dat het gratis Supabase-project pauzeert

Een gratis Supabase-project pauzeert automatisch na 7 dagen zonder enige
activiteit. `scripts/keep-alive.ps1` bezoekt de live site (wat automatisch
een databasebevraging doet), en `scripts/register-keep-alive-task.ps1` zet
dit als een dagelijkse Windows-taak.

Eenmalig instellen (op een pc die regelmatig aanstaat, bv. minstens 1x per
paar dagen):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/register-keep-alive-task.ps1
```

Dit maakt een taak "ZwemTicketsKeepAlive" aan die elke dag om 09:00 draait
(ook als de pc op dat moment sliep — hij haalt het dan alsnog in zodra de pc
weer aanstaat). Een logbestand `scripts/keep-alive.log` houdt bij of het
gelukt is. Te verwijderen met:

```powershell
Unregister-ScheduledTask -TaskName "ZwemTicketsKeepAlive" -Confirm:$false
```

## Nog niet inbegrepen (mogelijke volgende stappen)

- Automatische terugbetaling/annulering vanuit de admin-pagina
- Evenementen bewerken (nu enkel publiceren/verbergen/verwijderen — prijs of
  capaciteit aanpassen kan momenteel alleen via Supabase)
