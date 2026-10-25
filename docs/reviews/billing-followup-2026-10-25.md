# Modern billing and sampling follow-up — 25 October 2026

## Backend source fixes applied

The package pagination total now counts packages independently from grouped test/assignment joins. An empty database returns zero rather than destructuring an undefined count row; multiple joined tests no longer inflate totals.

New authenticated operations endpoints:

- `GET /api/v1/operations/control/billing/:id/outsourcing`
- `GET /api/v1/operations/control/tests/:id/outsourcing`
- `PUT /api/v1/operations/control/tests/:id/outsourcing`

These expose configured receiving organizations and permit initial assignment or reassignment before dispatch. They enforce branch/test access, scientist editing restrictions, concurrency checks, one case per ordered service and an audit trail. A previously unassigned billed test receives a pending tracking case so the existing request preparation/reprint page works. Assignment never records collection, dispatch or payment. A dispatched/closed case, returned report or existing outsourcing expense requires reconciliation instead of silently rewriting its destination or financial history. Sampling staff have a narrow exception for these endpoints and request preparation, not general provider configuration or laboratory administration.

## Frontend changes applied and tested

The prepared changes were applied to the sibling `lobnos` frontend after verifying their original file hashes. Further changes keep Pay Later available even when no payment methods are configured and avoid treating the automatically filled amount as an entered payment method.

- Receiving-laboratory dropdowns in modern payment, with explicit selection and review required after changes. Organizations remain optional at billing.
- “Save bill · Pay later at Cash Collection” remains usable after choosing full or partial payment. It constructs an unpaid payload without recording entered amounts, clears stale benefit/payment metadata, preserves tests/prices/outsourcing, and asks before discarding entered payment details.
- The shared submission callback returns success or pending delivery-preference status so modern payment does not report a successful or awaiting-confirmation submission as a failed save. Classic layout presentation and its submission processing remain intact.
- Sampling and both laboratory visit workspaces get an organization selector, audited assignment and a direct Prepare/reprint request link. Physical sample collection remains available because outsourced tests still need a collected, labelled specimen.

The temporary staging/apply helpers were removed after successful application. The actual frontend components and repeatable browser tests are the maintained implementation. Local clinical recovery evidence and browser artifacts are excluded from Git.

## Verification

- 196 affected backend tests passed across 17 files.
- 22 consultation/vital-sign MySQL checks passed in an isolated database, including exact legacy decimal preservation and repair of a zero-scale temperature column.
- 6 outsourcing MySQL checks passed against real SQL in a separate temporary database: branch scope, initial assignment, concurrency/version protection, scientist editing restrictions, expenses/reports and dispatch locks.
- 32 modern billing browser checks passed with the real components, frontend submission validator and backend preview service using synthetic fixtures. These include Pay Later from full/partial entry, cancellation, retry, no configured methods, changing an organization at payment, automatic catalogue loading, equivalent payer ID representations, desktop/mobile receipt flows, multiple receiving-laboratory rows, the unconfigured NHIS catalogue notice and exact long/leading-zero NHIS identifier submission.
- 6 sampling browser checks passed using the actual assignment and collection components: initial assignment, reassignment reason, conflict retention, request links, dispatched-case locking and mobile containment.
- 7 external laboratory request browser checks passed, including branded print documents, saved-request reprinting, failure retention and mobile preview.
- Backend TypeScript build passed. Frontend whole-application type checking still reports six existing errors outside these changes: the empty patient-auth login API route (reported by two generated validators), refund admin params, SMS route params (two diagnostics) and a stale `StageOutsourcedTable` type import. No applied billing/sampling component diagnostics were reported. A clean frontend production build is not claimed.

These checks use synthetic API data or freshly created temporary databases. No real bill, referral request, sample collection, payment, expense or external notification was created. Production deployment remains a separate operation.

## Catalogue setup loop corrected

“Choose tests & services” and the “Select items” navigation now load a missing or changed catalogue when payer details are valid. The container stays mounted during a modern catalogue request, retains setup on failure and reports the backend error inline. Services selection comes from the submitted billing state rather than a separate potentially stale toggle. A loaded catalogue is identified by the successful load's canonical payer context, not by array identity. Numeric/string IDs, entity casing and inactive package defaults do not cause false invalidation; actual patient, branch, payer, package, service, referral, related-bill and quotation changes do. Resuming a suspended bill retains the freshly validated catalogue key. Required payer fields and related-bill verification remain enforced. `scripts/test-modern-catalogue.cjs` also verifies the canonical context and payer validation rules directly.

## Receiving-laboratory presentation

The payment heading now precedes the receiving-laboratory card. Each test has a separate assignment row with its name/current laboratory, a labelled full-width selector, spaced Optional badge and refresh action. Rows use two columns on desktop and stack on mobile. Payment assignment mode excludes the unrelated Item options, price adjustment and Urgent controls; those remain available during item selection. Assignment and charge-review behavior are unchanged. Desktop/mobile screenshots were visually inspected, and browser assertions verify containment, row alignment and absence of pricing controls from this section.

## Unconfigured NHIS catalogue

The previous strategy lookup returned a string when no NHIS strategy existed. Initialization then passed it to `applyDiscountsToTests`, causing `tests.map is not a function` and the frontend's misleading session/patient error. Missing NHIS configuration now returns an empty test array without substituting General prices, including when a caller requests default-price fallback. Initialization supplies an explicit `NHIS_CATALOGUE_EMPTY` notice. Modern billing displays its title/message in the catalogue, while the classic layout shows an informational notice. An intentional empty result is considered loaded, avoiding a retry loop, and a subsequent populated catalogue clears the old notice. Real database failures still propagate as errors. Targeted strategy/initialization/preview tests passed (35 tests), and the backend build passed.

## NHIS submission: identifier overflow corrected

The reported submission failure was MySQL rejecting a membership identifier larger than the `dboservices.nhismembershipid` INT column could store. Both membership and claim-check fields now use VARCHAR(64). The guarded `20261025_nhis_identifiers` forward migration is registered in the standalone pipeline, startup prepares the schema, and NHIS submission also ensures it before transactional writes. Only those two columns change; existing wider text columns are preserved and the migration can be rerun.

Modern/classic inputs now collect identifier text. Initialization, bulk preview, suspended bills and final submission retain full digits and leading zeroes. The API still accepts safely represented legacy numeric payloads, normalizes them to strings, and rejects already imprecise numbers instead of inventing lost digits. Validation accepts 1–64 numeric digits with a nonzero value; this does not assert eligibility or provider verification.

The local upgrade verified all 27,016 existing service identifiers unchanged, and the specific local facility in the supplied error log was separately verified with both fields at VARCHAR(64). No real NHIS bill or payment was created by this work. Five isolated MySQL checks cover integer-to-text preservation, unrelated decimal precision, long/leading-zero identifiers, the 64-digit limit, transactional rollback and preservation of wider existing columns. Seventy targeted billing tests passed, the 32-check billing browser suite passed, and the final backend build passed. Frontend type checking has only the six existing diagnostics listed above. Refresh and re-enter identifiers previously entered through numeric controls before retrying a failed claim.
