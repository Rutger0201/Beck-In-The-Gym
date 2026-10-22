# Shared document workspace and card shortcut

The owner authorised the shared module after the initial website review. `/zakelijk/` is the online test workspace for BITG, BOTR, security and a configurable fourth activity. `/kaart/` is a separate installable BITG business card, rather than a shortcut that starts on the website homepage.

## Implemented

- One document engine, legal issuer and customer book. Each activity has its own name, logo, colour, service catalogue, default tariffs, terms and test number series.
- Quotations and invoice concepts, customer selection, custom lines, fractional quantities, per-line discounts, mixed VAT, saved statuses, quote-to-invoice conversion and source references.
- Exact scaled-integer arithmetic; round half-up to cents per service line and per line VAT. KOR applies at legal-entity level; it is not silently enabled for only one trade activity. VAT is unconfirmed until explicitly configured.
- Saved documents contain issuer, customer, brand, terms and price snapshots. Updating settings does not recalculate historical documents. Invoice conversion preserves the original line values.
- Print/PDF, explicitly labelled email drafts, full JSON backups, non-overwriting restore and read-only inventory of existing BOTR backups. No external emails are sent automatically.
- Browser-local IndexedDB transactions allocate test numbers atomically; revision checks reject stale overwrites. No existing BOTR storage keys or documents are touched.
- Independent card and workbench PWA manifests, icons, install help and scoped service workers. Offline caches contain public application files, never server APIs or a copy of the IndexedDB data.

## Test and production boundary

This is a functional local test workspace, not the authenticated shared-server administration. PDFs are always labelled test/concept documents and numbers always start with TEST. The UI cannot issue definitive invoices. Device loss or clearing browser storage loses local data unless a backup has been downloaded.

Production work uses the existing admin authentication/mandatory TOTP boundary and PostgreSQL architecture. Before enabling issuance, add server-authorised customer/document endpoints, centrally locked number sequences, immutable issuance snapshots, audit trails, backup/restore and outbox delivery. Reconcile original BOTR JSON and PDFs before any actual migration; keep the old system available.

The current prototype supports one legal issuer with four activities, not four assumed separate legal companies. Security/fourth-activity icons are configurable placeholders; no unknown legal names, contact details, tax statuses or tariffs are invented.

## Sources checked on 22 October 2026

- [Belastingdienst: invoice requirements](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/factuureisen): required issuer/customer information, supply details, VAT and unique sequential invoice numbering.
- [Belastingdienst: VAT rounding](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/btw-bedrag_afronden): arithmetic rounding; use a consistent per-line or total-based method.

Actual VAT treatment and business data remain owner/accountant configuration, not inferred from the activity name. Test numbering does not replace centrally controlled real invoice numbering.
