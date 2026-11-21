# Clinical safety controls: server-side QC and delta checks

This release closes two of the highest-consequence gaps in the review:

- **G4** — QC status was supplied by the browser, so a malformed or malicious client could unlock result entry with `status: "normal"`.
- **G2** — no delta checks existed, so a result that changed sharply from the patient's previous value passed unflagged.

Both controls run on the server and are audited. Neither changes behaviour until a delta rule is configured; QC status is now always computed.

## 1. Server-side QC (`G4`)

### What changed

`QCReadingsController.create`, `update`, and `addReadingsToSession` now:

1. Resolve the session and its control material.
2. Load the matching `control_parameters` row (target mean, SD, warning/action limits).
3. Compute the z-score and Westgard rules from the **prior readings in the same session plus the new value**.
4. Persist `status`, `z_score`, `rule_violations`, `evaluated_at`, `evaluated_by`.
5. **Ignore any `status`, `z_score`, or `rule_violations` sent by the client.**

`QCEnforcementService` already reads `qc_readings.status`; that value is now trustworthy because only the server writes it.

### Rules evaluated

| Rule | Meaning | Result |
|---|---|---|
| 1-2s | one reading beyond the warning limit (default 2 SD) | warning |
| 1-3s | one reading beyond the action limit (default 3 SD) | critical |
| 2-2s | two consecutive readings ≥2 SD on the same side | critical |
| R-4s | two consecutive readings ≥2 SD on opposite sides (range ≥4 SD) | critical |
| 4-1s | four consecutive readings ≥1 SD on the same side | critical |
| 10-x | ten consecutive readings on the same side of the mean | critical |

A parameter with no standard deviation is stored as `unmonitored`, which the result-entry gate treats as not cleared.

Warning and action limits are converted to z-thresholds when configured; otherwise 2 SD and 3 SD are used.

### Storage

`qc_readings` gains `z_score DECIMAL(8,4)`, `rule_violations TEXT`, `evaluated_at DATETIME`, `evaluated_by INT` through `bootstrapCalculationAndQcTables` and is idempotent on every start.

### API behaviour

`POST /api/v1/qc/readings` and the batch endpoint still accept a reading value and parameter id, and now return:

```json
{
  "status": true,
  "evaluation": { "zScore": 3.2, "status": "critical", "violations": ["1-3s"] }
}
```

`PUT /api/v1/qc/readings/:id` recomputes on a value change. Other client-supplied fields are discarded.

## 2. Delta checks (`G2`)

### What changed

Result approval (`ResultApprovalService.approve`) now compares each numeric parameter with the **most recent prior numeric result** for the same patient, test and parameter inside a configured window.

- A **warn** rule records an audit event and allows release.
- A **block** rule rejects the approval with HTTP `409` and code `DELTA_CHECK_BLOCKED`, listing the offending parameters, unless the approver supplies `delta_acknowledgement_reason` in the approval request.
- Every violation is written once to `pls_result_safety_events`; an acknowledgement updates that event with the approver and reason.

The check runs **inside the approval transaction**, so a blocked release cannot partially update the approval row.

### Rule precedence

Most specific wins: `field + test` → `test` → `global` (`testid = 0`, `fieldid = 0`).

### Tables

`pls_delta_rules`

| Column | Meaning |
|---|---|
| `testid` | 0 = all tests |
| `fieldid` | 0 = all parameters |
| `window_hours` | how far back to look for a prior result (default 720) |
| `max_absolute` | absolute change limit (nullable) |
| `max_percent` | percentage change limit (nullable) |
| `action` | `warn` or `block` |
| `active` | disable without deleting |

`pls_result_safety_events` stores the ascension, patient, test, field, encrypted previous/current values, computed deltas, rule id, action, and acknowledgement.

### Configuration API

Requires the test-panel management authority (administrators/managers with that permission).

```
GET    /api/v1/operations/result-safety/delta-rules
POST   /api/v1/operations/result-safety/delta-rules
PATCH  /api/v1/operations/result-safety/delta-rules/:id
GET    /api/v1/operations/result-safety/events?ascensionid=...
```

Example: block a creatinine change above 50% or 0.3 within 7 days:

```bash
curl -X POST "$BASE/api/v1/operations/result-safety/delta-rules?tenantId=309027" \
  -H "Content-Type: application/json" \
  -H "pls-prime-tenant-session: $TOKEN" \
  -H "pls-session: $SESSION" \
  -d '{ "testid": 100110, "fieldid": 259, "window_hours": 168, "max_percent": 50, "max_absolute": 0.3, "action": "block" }'
```

Approval override:

```json
{ "approval_revision": 3, "delta_acknowledgement_reason": "Repeat sample confirmed by supervisor; previous value was from a different lab." }
```

### Why no default rules

A default rule would start blocking releases on every facility after deployment. The engine is inert until a rule is configured, which lets each laboratory validate its own clinical thresholds first. The review's recommendation is to seed rules per test group in a controlled change window.

## 3. Rollout

1. Restart the service. The bootstrapper creates the columns/tables per tenant; the reviewed migrations do the same for desktop installations.
2. Configure a small set of rules (creatinine, potassium, haemoglobin, glucose, INR) with `action: "block"`.
3. Run a parallel day: review `pls_result_safety_events`, tune limits, then enable more tests.
4. Add the configuration UI (next frontend slice) so laboratory managers do not need the API.

## 4. Tests

```
cd lobnos-server
pnpm exec vitest run src/models/QualityControl src/models/results src/models/operations/ResultApprovalService.test.ts
```

- `QCStatistics.test.ts` — all six Westgard rules, custom limits, unmonitored parameters.
- `ResultDeltaService.test.ts` — numeric parsing, delta maths, rule precedence, inactive rules, either-limit trigger.
- `ResultApprovalService.test.ts` — existing approval contract still passes.

Live checks performed against the development tenant:

- QC: a posted `status: "normal"` with a 3.2 SD value was stored as `critical` with `["1-3s"]`; a second high value produced `2-2s`; editing back to target recomputed to `normal`; non-numeric and foreign-parameter requests were rejected.
- Delta: a real patient pair (55 → 544) produced one blocking violation, one audit event, and the acknowledgement was persisted; deactivating the rule stopped the block.

## 5. Still open

The following items from the clinical safety table are **not** delivered by this release and need separate work:

- **G1** patient identity, duplicate detection and merge (requires a patient-data migration review).
- **G3** autoverification rules.
- **G5** amended-report versioning and electronic signatures.
- **G6** structured allergies/interactions.
- **G8** ISO 15189 document control, CAPA, competency.
- **G9** critical-result read-back verification and escalation timers.
- **G10** calibration/maintenance and lot-to-lot QC.

## 6. Electronic consent — 21 November 2026

Registration/general laboratory consent and ordered-test/procedure consent are available from patient registration, the laboratory visit, and the CRM/Laboratory Electronic consent links. Administrators and managers publish facility-reviewed wording as new versions. No consent is assumed or pre-signed.

Staff record the patient or guardian decision, typed electronic signature, guardian relationship, identity-check method, and witnessing staff identity. Each record preserves its exact wording, version and signed snapshot hash. Withdrawal adds an audit event and retains the original signature and wording. Refusal is recorded explicitly.

Consent is confirmed inside sample collection, with one staff-witnessed verbal-consent confirmation. Patient names are filled automatically; guardian identity and relationship remain explicit. One confirmation covers the applicable versioned forms for the visit and is saved in the collection transaction. The separate consent page provides history, refusal, withdrawal and exceptional typed-signature capture.

Facility Result Entry Settings select consent Off, Optional or Required. Off hides the collection prompt; Optional permits recording without imposing a workflow hold; Required enforces the published forms marked required, including procedure forms restricted to a panel. Missing, declined, withdrawn, superseded or altered records cannot satisfy an enforced form. Stale wording or a confirmation for a different patient/visit is rejected. Existing signed records and withdrawal history are retained in every mode.

Sign & Release is independently configurable. Existing facilities retain mandatory signing by default. When disabled, validated reports may print without a separate signature event; payment restrictions, critical-result holds and separately configured manager approval remain in force. No release or signature is fabricated, and archived report versions remain available.

The shared Test Details Save Changes action also saves Linearity and Delta rules transactionally. Configure these checks from Test Details; the earlier API-only rollout instruction is superseded.
