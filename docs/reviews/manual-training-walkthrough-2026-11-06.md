# Staff walkthrough and manual verification — 6 November 2026

## Facility and scope

TAMALE GENESIS, authorized Admin session. All clinical examples are explicitly fictional. No real specimen was tested. PIN entry was performed by the user only. Authorization, payment requirements and tenant selection were not relaxed.

## Verified training sequence

- Patient 5 / NE-000005-MY, TRAINING MANUAL PILOT NOV05: registration completed through the four wizard stages.
- Bill 67, cashier code BBK6: WIDAL and FBC ADULT MALE, subtotal GHS85.00, tax GHS8.50, total GHS93.50. Separate-cashier handoff saved the bill unpaid.
- Cash Collection found BBK6. GHS30.00 collection left GHS63.50; the subsequent GHS63.50 collection settled the bill. Receipt reprint opened without creating another collection. Physical printer output was not verified.
- Sample S-20261106-52F1C902 linked ascensions 170 and 171. Start, complete collection and acceptance were verified through the application. The proposed Unspecified container is a clinical configuration gap, not an endorsed specimen plan.
- Processing bypass correctly places eligible requests in Completed stage after the worklist fix. No processing timestamps were fabricated.
- WIDAL ascension 171: opening one test now opens that test's form through an explicit confirmation. The user saved demonstration values and training-only comments with their own PIN.
- The user then saved a fictional amendment. Read-only verification confirmed approval revision 2, isapproved 0 and requires_revalidation 1, even though initial validation had been bypassed by existing facility configuration.
- The live validation queue displayed WIDAL as Changed — revalidation required.

## Additional defect and fix

The visit overview omitted dboservices.paymentstatus from its projection. The frontend consequently treated this paid service as having unknown payment status and correctly failed closed, producing a misleading payment-required block. The query now includes the persisted service status; it does not assume paid, change billing balances or bypass payment policy. Three regression cases cover paid, partial and unpaid status with the tenant ID, bill parameter and service join retained.

## Pending live acceptance

Final approval of revision 2 and refresh verification of the new payment-status projection remain pending. The current-facility purchase/receipt and department stock walkthrough also remains pending. Browser control was declined, then a user-confirmed retry was rejected by a saved origin permission for http://localhost:2377. No alternate browser, direct API mutation or database write was used to circumvent that restriction. Prior GMS stock tests are separately documented on 5 November and must not be represented as new TAMALE GENESIS tests.

## Automated and document checks

- Full frontend suite: 1,144 passed, zero failed/skipped.
- Full frontend TypeScript check: passed.
- Focused backend payment/workflow suite: 112 passed, including the new overview regression.
- Backend build: passed.
- Manual: 150 pages, 65 procedures, 12 original/reference images; five enhanced pilot procedures label completed and pending checks explicitly.
- Module order: CRM/front desk, billing, laboratory, inventory. Shared introduction explains philosophy, purpose, module coverage and handoffs.
- PDF images and new chapter/pilot pages rendered and visually reviewed. An orphaned screenshot heading was corrected. No empty pages, replacement characters or broken named internal destinations were detected.
- Served download returned HTTP 200 application/pdf, 1,194,095 bytes, matching generated SHA-256 15f42ccf30da07b9bb88a15cb6524ad5262058626d7aa66f45ce3265a39217b5.

Training records remain as audit evidence. Physical printing, every restricted role, clinical suitability and unexecuted workflows are not claimed as verified.
