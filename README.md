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

## Project

- `apps/web`: publieke NL/EN-website, vCard, QR-code, SEO en aanvraag-endpoint.
- `apps/admin`: login, verplichte authenticatorbeveiliging, contactbeheer en e-mailjobs.
- `packages/core`: gedeelde routes, validatie en beveiligingshelpers.
- `packages/database`: Drizzle-modellen, PostgreSQL-migraties en opslag.
- `docs`: architectuur, ontwerp, migratie, beheer en acceptatie.

De meegeleverde originele README en starter-ZIP zijn bewaard. De bestaande Beck on the Rocks-website en browserdocumenten zijn niet gewijzigd.

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

Kopieer nooit `.env`, exports met klantgegevens, databases of herstelcodes naar GitHub. De code ondersteunt één juridische onderneming met meerdere activiteiten; de factuurgenerator en het vieractiviteiten-dashboard zijn bewust een latere fase.
