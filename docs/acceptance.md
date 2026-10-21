# Acceptance and release record

## Completed in this implementation

- Public bilingual page structure, responsive layouts, both themes, original supplied logos, self-hosted fonts with licences.
- Five services, intake, local Almere copy, FAQ, prepared experiences page, contact page and digital card.
- vCard and QR endpoints, per-language metadata, canonical/hreflang, sitemap and conservative noindex defaults.
- Bounded server validation, restricted database submission, atomic contact/outbox writes and rate limiting.
- Separate admin app with password/TOTP enrolment and recovery codes, server-side membership checks, contact statuses and audit writes.
- Mail worker/retries, retention cleanup, schema migration/provisioning scripts, tests and operations/migration documentation.

## Verification record

See the implementation handoff for the exact commands executed and their outcomes. A successful static preview is not a successful Next.js build or proof of live mail/authentication. Dependency/network failures must be recorded, not replaced by an assumed pass. GitHub CI is configured to exercise units, types, production builds, an isolated PostgreSQL test and browser design checks.

## Must pass before launch

- [ ] Owner approves fonts, logo placement, both themes and final hero photography/video choice.
- [ ] Confirm trainer description and AALO wording; no diploma claim is present by default.
- [ ] Confirm DeMIX location/access wording and permissions for photographs/logos where relevant.
- [ ] Confirm domain, BITG contact channels, legal name/address/KVK and applicable VAT ID.
- [ ] Review host/email/analytics processor terms, lawful basis, retention and final privacy text.
- [ ] Full production builds, type checks and all relevant tests pass with pinned dependencies.
- [ ] Test real public and admin applications: request → saved lead → two email acceptances → authenticated owner → status update/audit.
- [ ] Verify 2FA enrolment, password login, second factor, recovery-code use and session expiry; unauthorised admin/API access denied.
- [ ] Verify spam limits, malformed/oversized requests, retry idempotency and controlled failure when mail/database is unavailable.
- [ ] Verify sender domain, email deliverability, scheduler, exhausted retry visibility and retention cleanup.
- [ ] Check keyboard, screen-reader labels, zoom, touch targets, both themes, reduced motion and representative mobile/desktop widths against WCAG 2.2 AA.
- [ ] Measure actual mobile/desktop performance; target LCP <2.5s, CLS <0.1 and INP <200ms. No measured performance claim is made yet.
- [ ] Check canonical/hreflang, sitemap, status codes, OG images, no private routes in indexing and analytics query-string suppression.
- [ ] Rehearse database restore and deployment rollback without losing new requests.
- [ ] Record explicit final publication approval. Neither creating a branch nor a review PR publishes the website.

## Deferred by design

Four-activity dashboard, actual legacy imports, quotation/invoice issuance, customer portal, payments, subscriptions, mobile app, AI training plans and external system integrations need their later approval gates. The supplied read-only backup inspector is not a data migration.
