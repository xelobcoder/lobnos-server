# Collection supply usage

Open a patient's Physical Sample Collection screen. After starting collection, each physical sample has a **Record supplies used** panel. Search active inventory, select supplies, enter actual quantities in their consumption units and provide a usage note. Confirming usage deducts stock; creating or completing a collection alone does not.

Supplies are recorded once per physical sample, including samples shared by several tests. Redraw specimens have their own records. Additional usage on an existing sample is a new explicit record with a new retry key. Recorded history includes the staff member, time, batch and usage note. The individual inventory movements also carry the patient, an associated ordered test and a physical-sample reference. Collection supply deductions are excluded from the laboratory material-plan totals.

GET and POST `/api/v1/operations/phlebotomy/supplies/:sampleId` require an authenticated administrator, manager, scientist or phlebotomist and matching tenant. Both supported spellings of the phlebotomist role are accepted. Patient and test links and branch scope are verified on the server. A shared sample uses its first linked test as the accounting/audit anchor, without multiplying usage by the number of tests.

Usage validates active items, positive quantities, whole-unit storage constraints, current stock and unexpired batch availability. Batches are consumed in expiry order. Stock movements, accounting outbox entries, usage intent and audit actions commit together. Identical concurrent retries return the existing record. The frontend retains uncertain requests in tenant-scoped session storage for an identical retry after a lost connection or reopening the collection screen.

No additional schema migration is needed beyond the existing operations-workflow schema. Deploy the backend and Lobnos frontend together. The supply picker is manual; this change does not infer supply quantities from specimen volume or laboratory processing templates.

Validation: backend build, frontend TypeScript source check and 25 focused workflow, permissions and inventory tests. No live patient transaction or browser interaction was performed.
