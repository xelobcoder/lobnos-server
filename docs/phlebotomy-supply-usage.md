# Collection supply usage

Open a patient's Physical Sample Collection screen. After starting collection, each physical sample has a **Record supplies used** panel. Search active inventory, select supplies, enter actual quantities in their consumption units and provide a usage note. Confirming usage deducts stock; creating or completing a collection alone does not.

Before creating containers, choose **Combine / split / change proposed containers**. Assign tests to the actual containers, choose the specimen and container types, and enter each container's actual amount and unit. Combining clears the target amount so it must be entered explicitly. The same test can be linked to more than one container when needed. A total draw amount is optional; when provided, container amounts must add up in the same unit. For example, a 5 ml draw can be recorded as 3 ml in EDTA and 2 ml in gel.

An override reason is required. Creating the plan starts collection for all its containers in one transaction, with individual barcodes. Existing physical containers and tests already undergoing processing cannot be replanned through this endpoint. The audit screen displays actual specimen/container choices alongside original configured test requirements. Catalog test definitions remain unchanged. Identical retries return the same plan; partial failures roll back all containers.

For each supply line, select the containers it served. A syringe used for two tubes is one line with quantity one and both tubes selected. Each tube can have its own inventory line assigned only to that container. Shared usage is deducted once and appears in the histories of all linked containers. Already recorded single-container usage remains visible and its saved retry requests remain compatible.

Supplies are recorded once per physical sample, including samples shared by several tests. Redraw specimens have their own records. Additional usage on an existing sample is a new explicit record with a new retry key. Recorded history includes the staff member, time, batch and usage note. The individual inventory movements also carry the patient, an associated ordered test and a physical-sample reference. Collection supply deductions are excluded from the laboratory material-plan totals.

GET and POST `/api/v1/operations/phlebotomy/supplies/:sampleId` require an authenticated administrator, manager, scientist or phlebotomist and matching tenant. Both supported spellings of the phlebotomist role are accepted. Patient and test links and branch scope are verified on the server. A shared sample uses its first linked test as the accounting/audit anchor, without multiplying usage by the number of tests.

Usage validates active items, positive quantities, whole-unit storage constraints, current stock and unexpired batch availability. Batches are consumed in expiry order. Stock movements, accounting outbox entries, usage intent and audit actions commit together. Identical concurrent retries return the existing record. The frontend retains uncertain requests in tenant-scoped session storage for an identical retry after a lost connection or reopening the collection screen.

No additional schema migration is needed beyond the existing operations-workflow schema. Deploy the backend and Lobnos frontend together. The supply picker is manual; this change does not infer supply quantities from specimen volume or laboratory processing templates.

The `/inventory/consumption` report combines legacy consumption history with actual phlebotomy and laboratory workflow stock movements. Existing workflow deductions appear without a backfill or another stock deduction. Workflow movements already represented by their transaction ID in legacy history are excluded from the added source. Pagination, date/staff filters and summary totals use the combined source. Phlebotomy has its own badge and summary count; details include patient, ordered test and usage reference. Decimal quantities are summed numerically.

Validation: backend build, frontend TypeScript source check and 25 focused workflow, permissions and inventory tests. No live patient transaction or browser interaction was performed.

Manual planning and shared-container usage validation: backend build, frontend TypeScript source check and 210 focused tests across 17 files passed. This includes actual override audit metadata, split-volume validation, concurrent retries, whole-plan rollback, branch boundaries and single deduction for a syringe shared between containers. Browser interaction remains untested.
