# Result revalidation after edits

Saving laboratory results clears current validators and increments the approval revision atomically with values, comments, calculated results and culture/sensitivity changes. A save after any prior approval sets a persistent requires_revalidation flag. It remains set through repeated saves and partial approvals until the configured minimum number of validators explicitly approve the new revision. Historical revision approval events remain intact. Initial-entry validation bypass is retained, but cannot clear or bypass this amendment flag.

The validator modal first loads an authoritative revision snapshot for every selected test, then mounts the result preview. Both single and bulk approval submit that revision; an intervening edit returns HTTP 409 and requires reloading/reviewing current values. Missing revision requests are rejected. The snapshot endpoint uses the authenticated tenant, employee and branch. Validator permission and minimum/maximum validation settings remain authoritative.

Result entry returns the current revision and amendment flag, with an explicit revalidation message. The validation queue marks changed results. Validation date filters follow last approval/result activity; direct ordered-test or billing links are not hidden by an unrelated default registration-date range.

Amended results cannot be printed/released by the staff report endpoint, marked delivered, or shown as approved in patient/clinician portals while revalidation is required. Existing delivery/audit history is retained. This does not retract copies already printed or sent and does not infer which historical edits were clinically reviewed before deployment.

Deploy backend and Lobnos together, restart the backend to apply the idempotent schema addition, then reload the frontend. The standalone migration allowlist includes 20261023_result_revalidation. Rollback retains revision safety/history. Live clinical transactions and migration execution were not performed during implementation.

The ultrasound editor also exposes the authorized result validation dialog, so amended imaging results have a review route. Validation permissions still apply.

Validation: 167 focused backend tests across entry, operations, revision API, portal release, delivery and provisioning; backend TypeScript build; frontend TypeScript source check; Next SWC compilation of the edited entry/validation screens. Live browser interaction and live migration execution remain untested.
