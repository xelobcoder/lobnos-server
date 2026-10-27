# Organization, laboratory cashier and thermal receipt review — 2026-10-27

## Critique and changes

| Deficit | Result |
| --- | --- |
| Organization list and forms used inconsistent cards, spacing and action styles | The directory, create/edit forms and contact/payment tabs now use the billing-strategy visual language: shared colors, readable labels, grouped fields, compact actions and a profile summary. |
| Repeated headings and repeated mobile details increased scrolling | The edit form removes its duplicate heading; small screens hide redundant summary details and use a single-column form. |
| Save failures could appear successful, or leave users without useful feedback | Create/update responses now distinguish success from failure. Duplicate conflicts appear beside the field; failed saves preserve entered values. Save buttons prevent repeated submissions. |
| Nullable organization/contact/payment data produced uncontrolled input warnings | Nullable fields display empty values while untouched form data keeps its original values. |
| Only organization names were checked; email/contact duplication could occur through several entry points | Create, edit, quick-add and imports now use tenant-local contact/email checks. Email comparisons ignore surrounding whitespace and case. Ghana local/international phone formats compare as the same number. A transaction lock serializes supported writers so simultaneous requests cannot both pass. |
| Logos were stored using a shared organization ID and upload reported an unimplemented result | Each new logo is stored under its authenticated tenant and organization. Uploads are bounded to PNG/JPEG, 5 MB; byte signatures are checked. Replacement is atomic and does not delete other tenants’ images. Reads verify that the organization exists in the active tenant and use private/no-store responses. |
| Laboratory billing lacked an explicit registrar-to-cashier option | Application settings now offer the current direct-payment workflow or a separate cashier. The latter saves an unpaid normal bill and allocates a four-character code in the same transaction. |
| A cashier code lookup could accidentally leave a previously selected bill on screen after a failed search | Starting a code search clears previous payment selections. Invalid codes cannot leave the old bill ready for collection. |
| Laboratory thermal receipts used large repeated sections, truncated item names and a fixed page length | POS/automatic thermal printing now follows the pharmacy style: company logo/contact header, full patient name, compact ITEM/QTY/RATE/TOTAL rows, saved totals, payment status, cashier code and barcode. Roll height adapts to content; very long lists paginate. The modern thermal preview uses the same saved data model; A4 remains available. |

## Workflow and financial compatibility

Use **Application settings → Billing → Laboratory payment workflow** to choose the new cashier mode and save settings. Existing installations default to **Registrar collects payment**. Pharmacy checkout settings remain independent.

In separate cashier mode, registration submits without cash payment. Cashier codes are persistent, tenant-local and branch-scoped, and can be recovered by bill ID. Cash Collection resolves the code to the original patient/bill, then uses the existing payment endpoint and receipt routes. Paid codes support receipt reprinting. Ordinary direct billing, adjustments, FOC authorization, NHIS claims, accounting, release restrictions and action authorization keep their existing processing paths.

The code is additional lookup metadata, not a second invoice or financial ledger. Receipt amounts come from saved `billing`/service records; the formatter does not recalculate prices, discounts, taxes or settlement amounts. The optional receipt lookup tolerates installations without the new code table.

## Rollout and existing data

The normal tenant bootstrap/migrations add the directory serialization row, cashier-code table and laboratory workflow setting. Restart/redeploy the backend to ensure these are installed before enabling cashier mode.

Existing duplicate organizations are not merged or deleted. Conflicts must be corrected through review. Old ID-only logos are left on disk but are not automatically assigned to a tenant: ownership is ambiguous when tenant organization IDs overlap. Re-upload each organization logo once into the new tenant-specific storage.

## Validation

- 140 backend tests passed across 13 files, including organization write paths, concurrent duplicate prevention, tenant-isolated logo replacement, authenticated logo identity, cashier-code allocation/rollback/recovery, branch/role boundaries, settings persistence, payment normalization, NHIS, pharmacy counter regressions and optional receipt-code lookup.
- 8 organization workspace browser checks passed, including inline duplicate feedback, successful correction, authenticated logo upload, contact/payment saves, Excel import access and desktop/mobile layouts.
- 8 lab cashier browser checks passed: both billing layouts, unpaid pending state, payment slip, direct/NHIS preservation, cashier lookup/payment, receipt routes, paid-code reprints and invalid-code state clearing.
- 8 thermal receipt checks passed, including partial/full/unpaid/NHIS/refunded bills, service-based insurance flags, 150-item pagination and mobile preview.
- 34 existing modern billing browser checks passed, including FOC/partial/NHIS, outsourcing, suspension, receipt reprinting and keyboard/mobile workflows.
- The 74 customer/organization action checks and 5 nullable organization-form checks passed during this implementation.
- 6 authenticated logo proxy contract checks passed. Backend build passed. Full frontend type checking was run as a final gate.

The browser and backend tests used synthetic data and mocked transport/database adapters, plus real temporary files for logo storage and real generated PDFs. No live patient, organization or payment records were created, deleted or altered by these tests. The sample receipt is clearly marked SAMPLE. Poppler rendering and PDF text extraction verified one 80 mm page, all ten sample tests, the patient’s full name, code and saved totals.

Automatic approval review rejected an unconditional new-table lookup in the shared receipt generator because it could disrupt older installations. That proposal was not applied; the installed implementation checks table availability before looking up the optional code.
