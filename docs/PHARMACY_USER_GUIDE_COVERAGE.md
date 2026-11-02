# PLS Pharmacy practical-guide coverage

The [page inventory](PHARMACY_PAGE_INVENTORY.md) was created before the corrective manual implementation. It records actual routes, controls, role gates and API operations.

## Completion rule

Each significant action requires: exact opening path, actual fields/control labels, numbered steps, expected effect, a specific way to verify the result, safe recovery and the next page. A conceptual paragraph or a passing rendering test is not action coverage.

## Initial corrective baseline

| Area | Source inventory | Practical guide status at start | Runtime status |
|---|---|---|---|
| Overview, POS, counter, sales history | Inspected | Existing brief topics need expanded controls and verification | Earlier isolated coverage only; live acceptance not claimed |
| Collections, cashier shifts, prescription creation | Inspected | Dedicated page instructions missing | Not verified by this corrective pass |
| Clinical and NHIS | Inspected | Existing brief topics omit multiple actions | Not verified by this corrective pass |
| Catalogue, stock, inventory, purchase review | Inspected | Purchasing help exists; full shared-page action coverage incomplete | Earlier isolated purchasing tests; manual not yet action-verified |
| Stock safety & checks | Eight tabs inventoried | Count-only help is insufficient | Not all tabs exercised |
| Cash & financial days | Inspected | Daily-first UI and brief guide implemented; full guide pending | Updated browser validation interrupted |
| Analytics, pharmacy settings | Inspected | Expand tab, field, export and recovery instructions | Not all operations exercised |
| Accounting overview and 18 child registers | Inspected | Too concept-oriented; replace with page procedures | Prior accounting harness evidence, not proof of manual completeness |
| Three accounting detail routes | Inspected | Dedicated guides missing | Practical-guide validation pending |
| Learning Center index/article | Inspected | Reader exists; incorrect section order and terminology-heavy navigation | 126 frontend tests and TypeScript passed before correction |

The corrective publication and verification status is maintained in [the validation report](PHARMACY_HELP_VALIDATION_REPORT.md). Do not mark an unexecuted operation complete merely because its button is mentioned. Representative-user, live-tenant, and full action-level acceptance remain separate gates.
