# Setup, hosting and operations

## Local database

Use Node 24 and PostgreSQL 17. Create an empty `bitg` database and three separate logins: a schema/migration owner, `bitg_web`, and `bitg_admin`. Set their connection strings in an ignored root `.env`. Never pass passwords as command-line arguments or put production credentials in a workflow.

After installing dependencies:

```sh
npm run db:migrate
node --env-file=.env scripts/grant-roles.mjs
npm run admin:create
```

The migration command records checksums and takes an advisory lock. Applied files must never be changed; add a new migration instead. The grant script expects both application login roles to exist. Verify the web role cannot select or update contact tables. Owner creation uses the migration connection and prompts for a hidden password. Log into the admin application and complete authenticator enrolment before accessing requests.

## Managed hosting proposal

Deploy web and admin as distinct Node services and PostgreSQL in the same Frankfurt region. Render is a candidate, not a purchased service. Select an always-on paid service/database and review current prices, storage, backup retention, processor agreements and international processing. Reserve the agreed €25–60/month budget; confirm the actual quote before provisioning. Database-region residency alone is not a claim that every provider/subprocessor operates exclusively within Europe.

Build web: `npm install && npm run build --workspace=@bitg/web`; start: `npm run start --workspace=@bitg/web`. Use the analogous commands for `@bitg/admin`. Both run from the workspace root and use the host's PORT. Keep migration credentials out of both application runtimes. Give the public service only DATABASE_URL; give the admin service only ADMIN_DATABASE_URL and auth/job/mail secrets. Public form availability also requires mail delivery configuration; ensure these readiness flags accurately reflect the configured job service. Brevo keys need not be exposed to browser bundles.

The public service needs SITE_URL, verified public contact data, RATE_LIMIT_SECRET, DATABASE_URL, and the server-side mail-readiness settings. The admin service needs ADMIN_URL, ADMIN_DATABASE_URL, BETTER_AUTH_SECRET, JOBS_SECRET, BREVO_API_KEY, MAIL_FROM and CONTACT_RECIPIENT_EMAIL. Generate distinct cryptographically random secrets of at least 32 characters and store them in the host's secret manager.

Configure the production ingress to overwrite X-Forwarded-For before setting TRUST_PROXY=true. Otherwise all anonymous requests intentionally share a conservative rate bucket. Never trust a caller-controlled IP header. Check the actual host proxy behavior. Database TLS verification must remain enabled where TLS is used; use the provider's CA chain and never set rejectUnauthorized=false.

## Mail and retention jobs

Verify the sender domain with SPF/DKIM and appropriate DMARC before sending. The owner notification includes an admin link, not copied medical/free-text details. Customer acknowledgements use fixed Dutch/English templates. Avoid marketing enrolment.

Run `node scripts/run-jobs.mjs` every minute from a managed scheduler with ADMIN_URL and JOBS_SECRET in secret environment bindings. The endpoint accepts POST plus a constant-time checked Bearer secret; GET is not a job trigger. Check failed/stuck mail jobs and provider delivery outcomes. A completed send call means provider acceptance, not guaranteed inbox delivery.

Review the six-month lead retention policy with the owner before launch. Automatic deletion uses retention_at, with cascading deletion of mail jobs. Financial documents are not in this release and must not inherit this policy. Audit metadata does not contain copied messages or names. Review operational log retention, database-provider logs and proxy logs separately.

## Backups and incident handling

Enable encrypted daily managed backups, at most thirty days for this lead database unless an approved purpose requires otherwise. Keep recovery keys outside the repo. Rehearse a restore into an isolated database before launch, then periodically. A restored backup must run the overdue-retention cleanup before public access is restored so deleted leads are not reintroduced. Record the measured recovery time and acceptable recovery point with the owner.

Monitor health, 5xx rates, failed login/rate-limit spikes, job failures, outbox age and backup completion without logging form bodies or credentials. Rotate secrets after suspected exposure, invalidate sessions if needed and follow the documented incident/privacy response process. Dependency and OS/security updates remain ongoing work even with managed hosting.

## Publication and rollback

There is no automatic production deployment in this repository. Obtain approval for design, contact/legal details, privacy configuration, hosting cost and final publication. Run release:check with production environment values and the acceptance checks. Only then change PUBLICATION_APPROVED and BUSINESS_DETAILS_APPROVED. Rebuild both applications after environment-dependent public-content changes. GitHub Pages does not run these server endpoints; do not point production to a static export and assume contact/admin works.

Keep the previous deployment version for application rollback. Restore databases only under a separately reviewed plan; a rollback must not discard new contact requests. Changing the repository to private is a separate GitHub setting and may affect the old Pages setup; do so during the approved hosting transition.
