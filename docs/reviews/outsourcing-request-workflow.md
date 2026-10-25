# External laboratory requests

Entry: Laboratory → Outsourcing → Request / reprint, or Review case → Create / view external laboratory request.

The request page selects open cases for one patient and receiving laboratory. Each selected test requires a specimen type and sample identifier; collection date/time, handling instructions, requesting practitioner, contact and clinical information can be supplied. Creation uses authenticated laboratory workflow roles and the existing branch/assigned-test visibility policy. It does not dispatch the specimen, bill a client, pay a provider, send a message, or release a result.

Requests receive an OR- reference and an immutable snapshot stored as a `referral_created` event in `lab_control_audit`. The patient, test names, receiving facility and referring company are loaded by the server. A retry key and locked case rows prevent duplicate creation on repeated submission. Existing references can be reopened and printed from the originating case, including after completion. Reprinting checks current access to every included case.

Printing opens an A4 document with company branding, patient identity, receiving facility, test/specimen rows, clinical information and a receiving acknowledgement line. The browser print dialog also supports Save as PDF. The current company logo is used; the textual request snapshot is preserved. No external facility API transmission is implemented.

No new table is required; this uses the laboratory operational-controls schema already bootstrapped by the application. Deploy backend routes and frontend together.

Checks: 27 workflow/request/authorization tests and 7 browser checks passed against isolated fixtures. These checks do not substitute for a production MySQL integration test. Frontend type checking reports the existing patient-auth, refund, SMS and legacy outsourced-table errors, with no errors reported for the new request components.
