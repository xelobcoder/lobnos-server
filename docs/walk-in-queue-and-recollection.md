# Walk-in queue, specimen recollection and turnaround time

Open **Walk-in Queue & Client Tracking** from Laboratory Operations, Phlebotomy or Customer Management.
The staff workspace supplies the facility's **Check-in** and **Facility display** links. A published public catalog is not required.

- Check-in requires a name and phone number, without an account. Arrival time and a daily ticket number are recorded by the server. Repeated submission of the same request returns its existing ticket.
- Reception calls a ticket to a named desk, starts service and links its patient or bill. Registration and billing handoffs retain the ticket. Staff can also correct the linkage from the queue card.
- Each linked bill supplies distinct laboratory-test counts: total, results completed and results validated. Queue completion cannot hide unfinished linked tests.
- The display refreshes automatically and shows tickets, counters and progress. Names, phone numbers, patient identifiers, bill identifiers and test names remain in the authenticated workspace.
- Administrators and managers can change the ticket prefix and open or close public check-in or the display. Tickets retain their original numbers. Days follow Africa/Accra (UTC).

## Rejected specimens

The selected test, collection, validation and sample summary screens retain the rejection reason and expose **Recollect sample**. This creates a separately barcoded replacement linked to the rejected container. Retrying resumes that replacement. **Complete collection** records the actual collection; validation and processing still follow the normal eligibility rules.

History shows the original collection, rejection, review, chosen SMS/email delivery outcomes, replacement collection and subsequent validation. Further rejections extend the same chain. Existing rejection evidence is preserved.

Patients can open **Samples & recollection** to see their own rejection and replacement history and arrange another visit. Physical collection remains a staff action.

## Turnaround time

**Summary** and **Individual tests** are separate tabs. The summary supports threshold drilldown; individual test records retain their existing filters and pagination.

## Startup and interfaces

Restart the backend after deployment to create the additive `walk_in_queue_settings`, `walk_in_queue_counters`, `walk_in_queue_tickets` and `walk_in_queue_events` tables in each served tenant database. No live records are seeded.

- Public pages: `/queue/{facility-slug}` and `/queue/{facility-slug}/display`.
- Public APIs: `/api/v1/public/queue/{facility-slug}/config`, `/tickets` (POST) and `/display`.
- Staff APIs: `/api/v1/queue/tickets`, `/tickets/{id}` (PATCH) and `/settings` (GET/PUT).
- Patient APIs: `/api/v1/patient-portal/samples` and `/samples/{id}` (owned history only).

Public facility identifiers resolve to an active, licensed facility; caller-supplied tenant parameters are rejected. Check-in requests have an 8 KB JSON limit and per-process rate limiting. Ticket/settings mutations require their current version and record an audit event in the same transaction.
