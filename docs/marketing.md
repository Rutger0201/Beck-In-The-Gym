# Marketing module (phase 2)

The AI marketing dashboard lives in the admin application at `/marketing` (`/admin/marketing` redirects there). Every page and API route uses the same session, second-factor and owner-membership checks as the contact dashboard; writes also require the admin origin and a version check, and are recorded in `audit_events` without copied content.

## Modules

| Module | Code | Status |
| --- | --- | --- |
| A Research Engine | `packages/core/src/marketing/research.ts`, `library.ts` | Seasonal calendar, BITG theme library, aggregated contact-request signals. Results are fingerprinted (SHA-256 of normalised keys) and upserted, so repeated runs add no duplicates; expired items are removed. |
| B Opportunity Scoring | `scoring.ts` | Score 1–100 from relevance 35%, impact 30%, feasibility 20%, cost 15% (each 1–5). Each opportunity stores its factors and a written rationale. Expected impact carries a confidence level, which stays "laag" until measurements are connected. 10–20 opportunities are kept per month; the owner's decisions survive refreshes. |
| C Content Studio | brief templates in `library.ts` | Hook, outline, CTA and visual guidance per item. AI generation is phase 3. |
| D Marketing Calendar | `planner.ts`, `components/MarketingCalendar.tsx` | 30-day proposal within a weekly time budget (default 3 posts, 3 hours). Categories rotate, promotion at most once per 14 days, paid campaigns and outreach are never auto-planned. Month/week/day views, drag-and-drop, edit, approve, reject, regenerate. Replanning keeps approved, published and owner-made items. |
| E Publishing | — | Not connected. Nothing is published automatically; `scheduled` is reserved for future integrations, and `autoPublish` can only be `false`. |
| F Analytics | `leads.ts` | Weekly contact requests and a transparent lead-quality heuristic, computed from goal, format, experience, phone presence and message length only. No names, addresses or message text are read. External channels show "Niet gekoppeld"; the single sample chart is labelled "Voorbeeld". |

## Jobs

`POST /api/internal/jobs` (the existing scheduled mail job) also runs research when it is due (`researchEveryDays`, default daily). It never blocks mail delivery. Runs are leased in `marketing_runs`: one active run per job, an expired lease is marked failed and the job can restart. Manual runs are rate limited. Per-run costs are tracked in `cost_cents` (zero for the current free sources).

## Deployment

The module needs migrations `0002_marketing.sql` and `0003_two_factor_lockout.sql` and a re-run of `scripts/grant-roles.mjs` so the admin role can use the new tables. `0003` adds the columns the installed Better Auth two-factor plugin requires; without it the admin login fails with a Drizzle schema mismatch.

## Not yet included

AI text generation and media library (phase 3), weekly reports and configurable monthly jobs (phase 4), Google/Meta/TikTok/YouTube integrations and UTM attribution (phase 5), SEO module (phase 6). External API keys must be stored only in the admin service's secret environment.
