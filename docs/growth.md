# Growth Pipeline

The Growth Pipeline lives in the admin application at `/growth` (`/admin/growth` redirects there). It finds commercial opportunities for Beck In The Gym online, scores them, and gives the owner a CRM and an AI assistant to follow them up. Every page and API route uses the same session, second-factor and owner-membership checks as the rest of the admin app; writes also require the admin origin and a version check and are recorded in `audit_events` without copied content.

Nothing is ever sent to third parties automatically. Drafts are prepared, approved and copied by the owner; "Ik heb dit zelf verstuurd" only records that the owner sent it outside the system. The only e-mail the pipeline sends is the optional weekly summary to the owner's own `CONTACT_RECIPIENT_EMAIL`.

## Workflow

Daily discovery → processing → deduplication → AI analysis → scoring → database → dashboard → follow-up.

| Stage | Code | What happens |
| --- | --- | --- |
| Sources | `packages/core/src/growth/discovery.ts` (`planSources`) | Search terms × regions rotate across days within `maxQueriesPerRun`, so every combination is covered over time. Configured RSS feeds, iCal calendars and agenda pages run every scan. |
| Fetching | `fetcher.ts`, `robots.ts` | Public HTTPS only (private hosts, credentials and non-443 ports refused, every redirect re-checked). robots.txt is read and respected for every crawled URL; an unreachable robots.txt counts as "disallowed". One request per host per second, or the site's `Crawl-delay`. Bodies are capped at 2 MB. 429/5xx and network errors are retried up to twice with backoff (honouring `Retry-After`). |
| Parsing | `sources.ts` | RSS/Atom (including Google News), iCalendar, schema.org JSON-LD (events and sports organisations), Brave Search API and Google Programmable Search responses. |
| Processing | `classify.ts`, `text.ts` | Privacy screening, contact-detail redaction, category, place and distance, event date, rule-based factors. Ended events and undated items older than 60 days are dropped, as are places more than 3× the maximum distance away. |
| Deduplication | `discovery.ts` (`dedupe`), `packages/database/src/growth.ts` | Same canonical URL (tracking parameters removed), or a near-identical title (word overlap ≥ 0.7) with the same date, within a run and against the last 120 days. Other URLs of the same story are kept as "Ook gezien". |
| Locations | `discovery.ts` (`geocode`) | Coordinates from the source (iCal `GEO`, schema.org `geo`) are exact. Calendar and agenda locations without coordinates are geocoded with the PDOK Locatieserver (max. 10 per scan). Otherwise a known town centre is used and marked "plaatsniveau". |
| AI analysis | `packages/core/src/growth/ai.ts`, `packages/core/src/ai/claude.ts` | New or changed items only (content hash), highest rule score first, up to `maxAnalysesPerRun` and within the monthly budget. The model returns category, relevance, value and likelihood (1–5), the explanation and a next step through structured output. It may mark an item as "no opportunity", which moves a new item to Afgewezen. |
| Storage | `packages/database/src/growth.ts`, migration `0004_growth.sql` | Upsert by fingerprint. AI factors and an owner-chosen category survive refreshes; distance, urgency and reliability are recomputed every scan because they depend on today. Every discovery, refresh, analysis, status change, note and draft is written to `growth_history`. |

### Opportunity Score (0–100)

Six factors, each 1–5, with fixed weights shown in the dashboard:

| Factor | Weight | Source |
| --- | --- | --- |
| Relevance for BITG | 25% | AI, or strength/fitness keywords plus being within range |
| Commercial value | 20% | AI, or category (corporate highest) |
| Distance and location | 15% | Always computed: ≤10 km = 5 … beyond 2× the maximum = 1; unknown = 2 |
| Chance of partnership or client | 15% | AI, or category plus a named organisation |
| Urgency and contact options | 10% | Always computed: days until the date, plus a named organiser or official calendar |
| Reliability and freshness | 15% | Always computed: source type (official calendar highest, search results lowest) minus age |

The value estimate is only filled in when the source gives a concrete basis (for example a number of participants). No amounts, contact details or names are generated.

### Scheduling, retries and monitoring

`POST /api/internal/jobs` (the existing scheduled job, run every minute by `scripts/run-jobs.mjs`) calls `runDueGrowthJobs` after mail delivery and marketing research. It never blocks either. A scan is due after `scanEveryDays`; it runs with a 90-second budget (discovery stops at 55%, the rest goes to geocoding, storage and AI). Runs are leased in `marketing_runs` (`job='growth'`, ten-minute lease), so a crashed scan is released and the next tick retries it. "Nu scannen" uses the same code with a 60-second rate limit.

Each source's outcome is stored in `growth_source_checks` and shown under **Bronnen & instellingen → Bronstatus**; run statistics and AI costs are in **Runs en logging**. Failing sources are listed on the overview page.

The weekly summary (`job='growth_digest'`) goes out on Monday when switched on.

### CRM

Statuses: Nieuw → Interessant → Contact opnemen → In gesprek → Gewonnen / Afgewezen, on the board at `/growth/crm` (drag and drop or select) and on each opportunity page. Follow-up dates and note reminders feed the "Openstaande opvolgacties" panel.

### AI Action Assistant

On each opportunity page: collaboration proposal, e-mail to a company, promotion campaign, introduction message or acquisition plan. With AI configured, Claude writes a draft from the source data (placeholders in `[brackets]` for anything unknown). Without AI, or when the monthly budget is used up, a clearly labelled template is created. Editing an approved draft returns it to concept.

## Configuration

Settings are edited in the dashboard (stored in `growth_settings`). API keys live only in the admin service's secret environment:

| Variable | Needed for | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI analysis and AI drafts | Rule-based scoring and templates (labelled "Regels" / "Sjabloon") |
| `AI_MODEL` (optional) | Model choice, default `claude-opus-5-5` | — |
| `AI_EUR_PER_USD` (optional) | Cost conversion for the budget, default 0.9 | — |
| `BRAVE_SEARCH_API_KEY` | Brave Search API source | Source reported as inactive |
| `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` | Google Programmable Search source | Source reported as inactive. Google has closed this API to new customers; Brave is the alternative. |
| `BREVO_API_KEY`, `MAIL_FROM`, `CONTACT_RECIPIENT_EMAIL` | Weekly summary (existing mail settings) | Summary fails and is logged |

## Source availability

| Source | Status |
| --- | --- |
| Google News RSS search | Active without a key. Only title, link, publisher and date are used, as a feed reader would. Can be switched off. |
| Own RSS/Atom feeds, iCal calendars, agenda pages with schema.org data | Active once URLs are added in the settings. robots.txt is respected. |
| PDOK Locatieserver and BRT-Achtergrondkaart | Active, Dutch government open data without a key. The map tiles are the only external resource loaded in the browser (`img-src https://service.pdok.nl`). |
| Brave Search API, Google Programmable Search | Implemented; need keys. |
| Claude (AI) | Implemented; needs `ANTHROPIC_API_KEY`. |
| Facebook, Instagram, LinkedIn | Not implemented. None offers an allowed API to search other people's public events or posts (Instagram hashtag search needs an approved Business app; LinkedIn content APIs need partner approval). The pipeline does not log in or scrape these sites. Public Facebook event pages can still arrive through search results. |
| KVK, vacancy sites | Not implemented. The KVK API is paid; job sites have no open API. They can be added as a source module later. |

## Privacy (AVG)

- Only organisations, events and public pages are stored. URLs of personal social media profiles are dropped before processing.
- Text that combines first-person language with health terms (special-category data) is dropped.
- E-mail addresses and phone numbers in source text are removed before storage; the contact route is always the organisation's own page.
- Retention: public help requests 30 days, rejected opportunities 90 days after rejection, untouched new opportunities 120 days after last being seen, source checks 90 days. Notes, drafts and history are deleted with their opportunity.
- AI providers receive only the public title, summary, link, place and date of an opportunity. Lead data from the contact form is never sent.

## Deployment

Run `npm run db:migrate` (adds `0004_growth.sql`) and re-run `scripts/grant-roles.mjs` so the admin role can use the new tables. Both are production actions and need the owner's approval.

## Demo data

There is none. `is_demo` exists on the table for clearly labelled examples, but the pipeline never creates them; an empty dashboard means no scan has run yet.
