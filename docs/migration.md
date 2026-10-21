# Beck On The Rocks reuse and migration plan

## Keep working legacy behavior

The current generator supports quotations, invoices, cancellation documents, statuses, print-to-PDF, quotation-to-invoice conversion, local backups, file/text/OCR extraction, shopping lists, reminder messages and signed quotation links. It is browser-local and stores documents under their document number. Its calculations use current global settings, so historical PDFs are essential reconciliation evidence.

No real backup has been inspected or imported. No browser storage has been touched. The owner reports one device with real documents. Export using its existing backup button and preserve issued PDFs separately, in access-controlled storage outside Git.

## Reuse boundary

Reuse business knowledge and fixtures for statuses, document layout, conversion, reminders and import review. Refactor calculations into pure, tested functions. Keep cocktail recipes, party duration, shopping lists, rush rules, glassware and fruit-press logic in the bartending activity. Do not load OCR/PDF libraries on the fitness marketing pages.

Shared future capabilities: customers, lines, exact decimal calculations, document snapshots, configurable tax treatments, immutable issuance, audit events, delivery records, and per-activity templates. Keep issuer/legal entity separate from the selected trade activity. Do not assume four independent businesses.

## Migration sequence after separate approval

1. Export and securely copy the legacy JSON plus all issued PDFs. Retain originals unchanged and hash migration sources.
2. Validate the `beck-documenten`, version 1 format. The supplied read-only `inspectLegacyBackup` helper inventories numbers/types/statuses without recalculation or writes.
3. Stage an idempotent import keyed by source fingerprint and legacy number. Report duplicate or inconsistent numbers; never overwrite a conflicting document.
4. Reconcile every issued document with its PDF. Store original PDF and fixed settings/terms/tax/amount snapshots. Flag differences for the owner; never infer that today's rates applied historically.
5. Preserve legacy display numbers. Allocate future numbers centrally in a database transaction with a unique constraint and explicit series. Issued invoice numbers cannot be reused after deletion or cancellation.
6. Compare counts, totals, statuses and samples with the old generator. Approve the report and a restore rehearsal before cutover.
7. Keep the old generator and exports available during a controlled transition. New issued invoices use correction/credit documents rather than silent edits.

## Fiscal and privacy checks before implementation

Check current Belastingdienst invoice requirements, rounding, KOR applicability, applicable VAT per service, credit handling and retention. Ordinary invoice administration generally has a seven-year retention obligation, with exceptions. Contact leads have a separate retention purpose; a fiscal retention duty does not justify keeping all lead-form content indefinitely.

Use exact decimal values and a documented rounding policy. Validate with a bookkeeper before enabling issuance. A future acceptance link uses a high-entropy revocable server-side token, not client details encoded in query strings. Existing HMAC links can be preserved as historical evidence but are not a substitute for the new server authorisation boundary.

Sources: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/factuureisen and https://ondernemersplein.overheid.nl/wetten-en-regels/facturen-maken-en-versturen/ . Recheck when this module is approved; this plan is not a final tax determination.
