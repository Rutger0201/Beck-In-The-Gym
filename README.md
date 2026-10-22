# Beck In The Gym

Premium, tweetalige personal-trainingwebsite en een afzonderlijke beveiligde omgeving voor contactbeheer. Dit is een **reviewversie**: er is geen productiepublicatie uitgevoerd.

## Snel starten

Gebruik Node.js 24 en PostgreSQL 17. Voer in deze hoofdmap uit:

```sh
npm install
cp .env.example .env
npm run dev
```

De website draait op `http://localhost:3000`. Start beheer in een tweede terminal met `npm run dev:admin` (`http://localhost:3001`). Zonder database- en mailconfiguratie zijn contentpagina's bruikbaar en blijft het aanvraagformulier uitgeschakeld.

Voor alleen een ontwerpvoorbeeld, zonder externe dependencies:

```sh
node scripts/build-preview.mjs
node scripts/preview-server.mjs
```

Open `http://127.0.0.1:4173`. Dit voorbeeld verstuurt niets en bevat geen echte klantgegevens. Het gebruikt dezelfde pagina-inhoud en stijlen als de Next.js-website.

De online ontwerpversie staat op https://rutger0201.github.io/Beck-In-The-Gym/preview/ . Het afzonderlijke visitekaartje staat op https://rutger0201.github.io/Beck-In-The-Gym/preview/visitekaartje/ . De testversie bevat geen server of administratie; de contactdownload bevat alleen de bevestigde naam, merknaam en website.

Na installatie van de dependencies kun je dezelfde Pages-bestanden opnieuw maken:

```sh
node scripts/build-preview.mjs --qr --base-path /Beck-In-The-Gym/preview --origin https://rutger0201.github.io --output .local/pages-review
```

De centrale testwerkplek voor alle vier de activiteiten staat op https://rutger0201.github.io/Beck-In-The-Gym/zakelijk/ . BITG, BOTR, beveiliging en de configureerbare vierde activiteit gebruiken dezelfde documentkern, met eigen huisstijlen en diensten. De aparte installeerbare kaart staat op https://rutger0201.github.io/Beck-In-The-Gym/kaart/ . Beide apps hebben een eigen manifest, startpagina, icoon en service worker.

De werkplek bewaart testdocumenten in IndexedDB van deze browser. Iedere PDF vermeldt dat het een testdocument is; de nummers beginnen met `TEST-`. Definitieve factuuruitgifte, gedeelde serveropslag, beveiligde toegang en automatische mailbezorging zijn nog niet geactiveerd. Een e-mailconcept opent alleen je eigen mailprogramma en markeert niets automatisch als verstuurd.

De bestaande browsergebonden BOTR-generator blijft op https://beckontherocks.nl/documenten.html . Gebruik het oorspronkelijke apparaat en browserprofiel om bestaande documenten te zien. De nieuwe werkplek kan een BOTR-back-up uitsluitend inventariseren; bedragen en bestaande documenten worden niet automatisch gemigreerd.

## Project

- `apps/web`: publieke NL/EN-website, vCard, QR-code, SEO en aanvraag-endpoint.
- `apps/admin`: login, verplichte authenticatorbeveiliging, contactbeheer en e-mailjobs.
- `packages/core`: gedeelde routes, validatie en beveiligingshelpers.
- `packages/database`: Drizzle-modellen, PostgreSQL-migraties en opslag.
- `docs`: architectuur, ontwerp, migratie, beheer en acceptatie.

De meegeleverde originele README en starter-ZIP zijn bewaard. De bestaande Beck on the Rocks-website en browserdocumenten zijn niet gewijzigd.

## Marketingdashboard

De beheeromgeving bevat op `/marketing` een AI-marketingdashboard met kansen, prioriteitsscores, een 30-dagenkalender en leadanalyse. Er wordt niets automatisch gepubliceerd of uitgegeven. Zie [marketingmodule](docs/marketing.md).

## Controles

```sh
npm test
npm run typecheck
npm run build
npm run test:integration
npm run test:e2e
npm run release:check
```

De integratietest vereist een afzonderlijke testdatabase met twee rollen. De GitHub-workflow richt die tijdelijk in. Voer integratietests nooit uit op productie. Zie [beheerhandleiding](docs/operations.md).

## Publiceren

Volg eerst [de acceptatielijst](docs/acceptance.md). Vul alleen bevestigde BITG-bedrijfsgegevens in. De site is standaard `noindex`, analytics staat uit en er is geen automatische productie-deployment. De eigenaar moet ontwerp, bedrijfsgegevens, hostingkosten en publicatie goedkeuren.

Kopieer nooit `.env`, exports met klantgegevens, databases of herstelcodes naar GitHub. De gedeelde documentkern staat in `packages/core/src/documents.mjs`; de testwerkplek in `apps/business`. Eén juridische onderneming en de centrale klantenlijst worden gescheiden van de vier handelsactiviteiten en hun document-snapshots.
