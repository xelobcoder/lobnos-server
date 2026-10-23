# Laboratory operations integrity

The operations workspace is available at `/operations/laboratory/workbench` in Lobnos. Backend endpoints are under `/api/v1/operations/laboratory/workbench`.

## Changes

- Approval and delivery actions use the authenticated employee. Approval updates serialize concurrent validators, record each validator once per result revision, and invalidate previous approvals when results change. The UI distinguishes a recorded approval from final validation.
- QC authorization uses the latest review for today's test, branch and selected analyzer. A later rejection overrides an earlier acceptance. Active material, expiry, analyzer mapping and accepted readings are checked again while saving results. Historical sessions without branch scope cannot authorize result entry.
- Delivery includes finalized tests without preference or delivery-log rows. Successful delivery requires finalized results and the correct bill and branch. Attempts are retained separately; a failed retry does not erase an earlier successful delivery. The frontend displays the attempt history.
- Laboratory navigation keeps monitoring accessible in simplified workflows.
- The workbench supports self-assignment, supervised reassignment, version checks, handover reasons, priority, deadline overrides, manual escalation and acknowledgement. Actions retain an audit trail.
- Per-test routine, urgent and stat turnaround targets determine deadlines from the ascension time. Existing parseable turnaround settings initialize routine targets. An unspecified urgent or stat target falls back to the routine target. Existing age-bucket monitoring remains available as supplementary information.
- Actual material usage is explicitly recorded against an ordered test and inventory template. Usage validates available, unexpired batches and deducts in expiry order. Stock movements, accounting outbox entries, retry intent and work history share a transaction. Identical retries do not deduct again. Integer stock schemas reject fractional usage rather than silently truncating it. Additional actual usage requires a new intent.

## Rollout and operation

1. Restart the backend through the normal deployment process so tenant startup applies the idempotent operations schema additions. The standalone migration allowlist includes the operations and supplier-funding migrations.
2. Deploy/restart the Lobnos frontend and open the laboratory workbench.
3. Ensure staff have their operating branch assigned. Recreate and review legacy QC sessions that have no branch scope, using the correct analyzer or manual scope. Existing unscoped acceptance is deliberately not assumed to apply to a branch.
4. Configure test turnaround targets, inventory templates and the analyzer used for a test. Record material consumption only when material is actually used. Neither a purchase nor billing alone records consumption.
5. Use the existing processing screens to enter results; use the workbench for ownership, deadlines, QC status, consumption and history. Escalations are manually recorded and acknowledged; this change does not add an automatic escalation notification scheduler.

The migration preserves operational audit records on rollback. It does not reconstruct missing historical consumption or accounting entries.

## Validation

Backend build and frontend TypeScript source checks passed. The focused operations, inventory, QC, delivery and standalone-provisioning suite passed 152 tests across 16 files. The wider backend run identified three unrelated existing facility-role assertion failures in `FacilityInput.test.ts`; those authorization rules were not changed. The frontend source check used the installed Node and React type sets because the default environment has missing implicit `minimatch` and `react-dom` type packages. Browser interaction and a live clinical transaction were not performed.
