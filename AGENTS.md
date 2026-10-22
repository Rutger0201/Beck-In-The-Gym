# Working on Beck In The Gym

Read README.md and the relevant docs before changing behavior. Preserve user edits.

## Product boundaries

- No public prices, booking system, invented qualifications, results or reviews.
- Keep Dutch and English pages in sync; route helpers are the source of truth.
- Treat uploaded logos as brand originals. Keep licensed fonts locally hosted.
- Use dark UI only, as requested by the owner. Do not restore system/light themes or a theme selector. Original raster logos have visible edge defects; a high-resolution canvas does not make them vector originals.
- Don't copy bartending contact or legal details into BITG without confirmation.
- No production deployment, repository-visibility change, or legacy data migration without the applicable owner approval.
- The owner has authorised the shared four-activity document module. Its Pages workbench uses browser-local test documents. Definitive issuance and shared server storage require the production infrastructure. Do not modify Beck On The Rocks as a side effect.

## Security

- Validate all incoming data server-side. Never log submitted contact fields or secrets.
- Every administrative read/write needs session, second-factor and membership checks. Middleware and hidden links aren't authorisation.
- Keep the web database role insert-only through submit_bitg_contact; use the admin role only in the admin app.
- Do not weaken HTTPS, TLS certificate validation or origin checks to make tests pass.
- New migrations are additive; never edit an applied migration.
- Keep request, mail outbox and audit operations transactional. Preserve optimistic locking.

## Verification

Use Node 24. Run the relevant tests, typecheck and both production builds. Browser tests cover the static design preview; they do not prove authentication, PostgreSQL or email delivery. Use the PostgreSQL integration suite and full-app checks for those boundaries. Document blocked or unperformed checks honestly.

`PUBLICATION_APPROVED=false` and `BUSINESS_DETAILS_APPROVED=false` are defaults. Keep production deployment manual and separate from CI.
