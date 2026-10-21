# Architecture and audit

## Inspected baseline

BITG commit `7aeba712a7ad21984a6da22f3998e349cc7bd255` contained a README and a framework-independent starter ZIP, with no functioning application. Both repositories were publicly accessible during the audit. Beck On The Rocks commit `16753db2117faac2b5fb0d7c83bdeb7a2bd1e80d` contained static HTML/CSS/JavaScript, bilingual content, self-hosted fonts, SEO, a contact integration, vCard, and a local-browser document generator. The live reference site could not be loaded from the audit environment; source inspection is not a visual production test.

## Decisions

Two Next.js applications share an npm workspace, TypeScript helpers and a PostgreSQL database. Content-heavy pages are generated in advance. The public build never imports authentication or administrative UI. Public and administrative applications have separate origins, runtime secrets and database credentials. Next.js was chosen to keep the public/API/admin stack in one language. Astro would reduce static-site overhead but add another framework to maintain here.

Drizzle owns the typed models; reviewed SQL migrations own constraints, indexes and the restricted submission function. The public role has no table access. A SECURITY DEFINER function hardcodes BITG, atomically applies a rate limit, stores a contact request and creates two mail jobs. It never returns existing customer details. Retried request UUIDs don't duplicate requests or notifications.

The admin role reads BITG contacts and changes status with a version check. Membership, completed 2FA and a server-validated session are checked on every administrative path. Audit records contain action metadata rather than copied messages and can be appended, not modified, by the runtime role.

Authentication uses Better Auth rather than bespoke password/session handling. Public signup is disabled. Initial owners are created from a secure terminal, then must enrol an authenticator. Recovery codes are displayed at enrolment; keep them outside the application/repository. Session cookies are host-only. All providers and dependencies need ongoing security updates.

## Data flow

Visitor → same-origin request endpoint → Zod validation → bounded, keyed rate identity → PostgreSQL transaction → contact + outbox.

Scheduled administrative job → leased pending outbox records → fixed Brevo templates → delivery metadata. Failed sends are retried with backoff and stop after eight attempts. A provider/network crash can leave delivery uncertain; provider idempotency reduces, but does not make an unconditional exactly-once promise. Operational delivery counts must be checked.

Owner → password + authenticator → membership check → contact list → optimistic status change + audit event.

## Business separation

`legal_entities` describes the legal undertaking; `activities` describes brands/activities. BITG is the only seeded activity. No legal entity or KVK data is fabricated. The later dashboard can show four branded activity choices; tariffs, VAT treatment, templates and number series belong to explicit activity/legal-entity configuration. They are not embedded in public page bundles.

No customer portal, payments, AI planning, booking or invoice implementation is included in this first release. Standard Node/PostgreSQL deployment preserves portability to other EU hosts and future APIs.
