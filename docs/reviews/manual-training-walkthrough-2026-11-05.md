# Staff manual walkthrough â€” local training records, 5 November 2026

The browser walkthrough was performed in GLOBAL MEDICAL SERVICE using the signed-in Super Admin, with the user's express authorization to create training records and test saves, payments and inventory movements. Records remain in the local database as audit evidence.

## Saved patient and billing

- Patient 6038, NR-006038-NT: TRAINING MANUAL NOV05.
- Basic details, address and emergency contact saved through the registration wizard. Optional photograph/credentials skipped. Completion opened billing for the same identity.
- Blank mobile was rejected with the 10-digit requirement. Blank address Area was rejected. The manual now explains those required fields and correction on the saved identity.
- Bill 8713: WIDAL, GHâ‚µ40.00, Routine, General, explicitly marked TRAINING ONLY.
- Facility's cashier-handoff mode saved the bill unpaid and produced short code ATAW.
- Cash Collection found the same bill by code. GHâ‚µ10.00 cash payment left GHâ‚µ30.00 outstanding; final GHâ‚µ30.00 cash payment left GHâ‚µ0.00 and SETTLED. No physical receipt printing was requested.
- Receipt-copy guidance now includes the actual Cash Collection Reprint receipt link, in addition to Daily Sales Report reprint actions.

## Saved inventory movements

- Fictional item TRAINING MANUAL STOCK NOV05, SKU TRAIN-MANUAL-20261105; 100 Pieces received at zero unit cost.
- Laboratory request 5bba9c2e-283c-4b34-8e0b-0577c0e4fb16 (requisition c077e1cb-0ec2-4d91-b755-4a6c88d116a1): requested 10; approved 8; issued 8; physically received 8; normal consumption 2, with reason blank.
- Movement history retained approval, issue, receipt and consumption with staff and quantities.
- Items table reconciled company stock 98 Pieces = stores 92 + departmental custody 6.
- The manual now gives the exact receipt/consumption sequence and illustrates the stores/custody/company reconciliation.

- Imaging request b3b7d537-6ec0-496a-9f24-1457ef7bb7f2 (requisition 8833fdab-d029-4d5e-a2f2-816c07f8c85a): requested 4, approved and issued 6, received 5, consumed 1 without a reason. The short receipt required an explanation and created reported incident INC-1793869859830-d6c99e07. Incident detail showed the request, item, difference and receiver note.
- Stores returned the 1 unreceived Piece with supporting training evidence. Unreceived became zero and imaging usable stock became 4. The incident remains Reported for its separate investigation workflow; reconciliation does not automatically close it.
- Final Items table: company 97 Pieces = stores 87 + departmental custody 10 (laboratory 6 and imaging 4).
- Confirmed UI deficit fixed: Issue review now shows Approved and Quantity to issue, so an adjusted approval cannot be confused with Requested. A rendered-component regression verifies requested 4 versus approved/issue 6.

## Documentation and verification scope

- Full downloadable manual: 127 pages, 65 procedures across Operations, CRM, Billing and Inventory, generated from the same content as the in-app manuals.
- PDF checked for nonempty pages, internal destinations and 488 link annotations; revised registration/payment pages rendered and visually reviewed. Application-served bytes matched the generated PDF.
- Automated permission/session/navigation/manual and website regressions passed (103 focused tests). Production frontend build and strict TypeScript passed.
- Live writes above used Super Admin. Separate staff-role user acceptance, every clinical result/validation/printing scenario, incident closure, real external enquiry delivery and production deployment are not established by these local training tests. Do not describe those as completed live tests.

Keep these records visible for review. Do not delete financial or stock audit events to hide training activity; use the facility's authorized correction/reversal process if training data must be removed from operational reporting.


