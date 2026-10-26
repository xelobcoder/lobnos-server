# Commission request recipient contract

Organization and clinician route parameters are strings. Both payment pages submitted those strings as `recipientid`, while commission settlement requires a positive safe integer. That caused the generic recipient/employee/branch/date error before an expense request could be created.

Both pages now send a numeric recipient ID. The API also accepts strictly numeric strings for compatibility, normalizes them once and rejects malformed, fractional, nonpositive and unsafe values with a specific recipient error. Existing date parsing, signed employee/branch binding, per-service branch checks, expense-create permission, totals, waiver eligibility and approval/payment separation are unchanged.

33 tests passed across the request controller, commission allocation and transactional settlement. Regression cases include organization ID `"2"`, 1 January–26 October 2026, three services, GHS 56.50 earned and a GHS 20 partial request. Tests use fixtures and do not create real expenses. Backend build and frontend type-check results are recorded under `tmp/commission-recipient-fix`.

The backend must load the updated controller; no real payment request was submitted or automatically retried.
