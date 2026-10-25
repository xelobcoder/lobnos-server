# Consultation / practitioner portal review

Reviewed 25 October 2026. This is a source-code review of the frontend, API handlers, session middleware and vital-sign workflows, not a production penetration test or a clinical protocol review. The findings below describe the original defects. Consultation, invitation, authorization and vital-sign changes are now implemented; see [implementation and verification status](consultation-implementation-2026-10-25.md) for rollout requirements and the verified local temperature recovery. Package viewing and authorization were implemented separately in this change.

## Assessment

The portal has useful building blocks: a consultation workspace, history, laboratory requests, prescriptions, result tracking and a clinician-scoped results API. It does not yet consistently support the three intended operating models: an external referring practitioner, an employed facility practitioner, and a pharmacy practitioner. Its biggest gap is the relationship between practitioner identity, patient access and encounter authorization. Cosmetic improvements should follow that boundary.

## Priority findings

| Priority | Finding and evidence | Required correction |
| --- | --- | --- |
| Critical | `src/models/clincians/clinicianClass.ts`, `postClinicianBasicInfo`: after inserting one clinician, executes `UPDATE clinicianscredentials SET password = ?` without a WHERE clause. This can overwrite every clinician's password in that tenant and invalidate existing sessions. | Remove the redundant blanket update; keep credential initialization scoped to the new clinician in `applyClinicianAfterInsert`. Regression-test that adding a clinician leaves existing credentials and sessions unchanged. Review existing affected credentials before onboarding more practitioners. |
| Critical | `src/controllers/medicalRecords/medicalRecordsHandler.ts` accepts `consulationby` from the body. The model's `updateRecord` verifies ownership against that supplied value rather than the signed-in actor, then interpolates arbitrary body keys as SQL column names. | Derive author and tenant from the verified session. Allowlist editable fields. Check actor ownership and patient/encounter access before every read/write. Do not allow author, patient or encounter reassignment through a note update. |
| High | Consultation get-by-ID, list, pending and delete handlers do not enforce clinician ownership or a patient care relationship. Global middleware authenticates clinician tokens and tenant membership, but lacks the patient-style route allowlist. The newer `ClinicianPortalResultService` is better scoped; that protection does not automatically cover consultation endpoints. | Enforce capabilities and patient scope server-side on search, history, vital signs, orders and notes. Add negative tests for accessing another clinician's encounter, patient or facility. An encrypted URL is not an authorization boundary. |
| High | `proxy.ts` permits `/doctor` only for clinician/admin/exact `super admin` role names. Pharmacy-prefixed staff are restricted to pharmacy APIs by `pharmacyModuleBoundary`. An internal doctor cannot simply use staff access as an external clinician. Dashboard identity falls back between clinician ID, generic ID and employee ID. | Link a practitioner profile explicitly to its authenticated staff or external account. Use capability checks plus facility/branch scope; normalize roles consistently. Enable consultation for an authorized pharmacy practitioner without opening unrelated laboratory or administrative APIs. |
| High | Opening a new consultation immediately inserts an empty record. Pending services exclude any service with a consultation record. There is no explicit draft/signed state in the reviewed medical-record model. | Create or resume an encounter intentionally. Give drafts a visible lifecycle; remove from the pending queue on the agreed completion event rather than merely creating an empty draft. Add idempotency for encounter creation. |
| High | The main submit handler has no try/finally around its network call, displays any response message as a success toast, and treats a truthy update status as success. Model permission failures can be strings. Notes have no visible save/retry state, dirty-navigation protection or revision conflict handling. | Require an explicit successful response, always clear the busy state, keep the draft on failure, show the failure inline, protect unsaved work and detect conflicting edits. Use explicit draft save, sign and amendment states. |
| Medium | Consultation landing is only a fixed `col-5` patient filter. History search uses patient ID on one path and `search` on another, while the backend parses search text as an integer. Result length is presented as a total. | Provide a responsive queue with separate My referrals, Today's patients and My consultations views; search by the authorized patient's name/identifier, debounce requests, show real totals and retain filters. |
| Medium | Patient history and vital signs require modals, while notes, labs and drugs stack inside a table-based workspace. The permissions page is static prose rather than the effective permissions returned by the API. Menu links expose lab, pharmacy, commission and consultation sections without adapting to the practitioner's work. | Keep patient identity, allergies and latest vital timestamps visible. Use Notes / Lab requests / Prescriptions / History sections with clear save states. Adapt navigation to enabled modules and effective capabilities. Keep detailed histories available in a side panel or section without interrupting note entry. |

## Practitioner onboarding

`ClinicianAuthenticationView.tsx` is a checkbox-only placeholder with no saved state or request handler, and the reviewed clinician edit page does not render it. This does not provide the access-management workflow already present for patients. Existing clinician login, tenant-aware usernames, password recovery and credential-bound session invalidation are useful foundations.

Recommended workflow:
1. An authorized administrator selects a practitioner and confirms their contact details, facility/organization, role and permitted services.
2. A single Manage portal access panel shows Not invited / Pending / Active / Disabled / Expired, with the username and correct facility login link.
3. Send a short-lived, single-use activation invitation through an available configured channel. The practitioner sets a password; staff should not need to send or display a reusable password.
4. Show delivery status and support controlled resend, expiry and revocation. Disabling access must be enforced by the API and revoke existing sessions.
5. Link an employed practitioner's staff login to their practitioner profile so a second unrelated credential is unnecessary. Keep external accounts scoped to their referrals and explicitly authorized patient encounters.

Reuse the patient portal's invitation lifecycle and delivery infrastructure where appropriate, while keeping practitioner permissions separate. No invitations or credential messages were sent during this review.

## Proposed authorization matrix

| Account | Patients / history | Consultations | Orders / results | Administration |
| --- | --- | --- | --- | --- |
| External referring practitioner | Their referrals and explicitly granted care relationships | Create own; edit own drafts; signed notes by amendment | Their lab requests and prescriptions; only released/authorized results | Own profile; no facility-wide settings |
| Employed facility practitioner | Assigned/authorized care episodes in their facility and branch | Consult, sign and amend according to privileges | Order within enabled modules; read permitted results | No implicit user management or billing configuration |
| Pharmacy practitioner | Authorized pharmacy patients/episodes | Pharmacy consultation capability | Prescribe; external lab referral only when enabled | No implicit laboratory processing access |
| Nursing / triage staff | Assigned queue and permitted patient summary | Triage and vitals; no implicit right to sign a doctor's note | Role-specific visibility | No practitioner account provisioning |
| Administrator / manager | Administrative access with an audit trail | Clinical signing still requires clinical privileges | Operational functions as granted | Invite, disable and manage access |

Clinical signing should depend on practitioner privileges, not administrative seniority alone. Authorization must apply equally to direct API requests and visible controls.

## Vital signs review

- **Persistence defect:** `q_updateVitalSign` has nine placeholders, including date and time, while `updateVitalSignChart` passes seven arguments and omits SpO2 entirely. Correction must scope the update by patient and actual vital-row key, preserve the original observation time unless explicitly corrected, and persist SpO2. Check the deployed row key: delete currently uses `vitalsignid`, while update uses `id`.
- **Validation mismatch:** the frontend accepts SpO2 zero while the backend rejects it; frontend ranges differ from backend's positive-number-only checks. `parseFloat` plus comparison-only checks can let malformed nonempty input evade custom validation. Use strict finite-number validation and one consistent contract. Clinical warnings should be distinguished from impossible input; valid extreme observations should not be silently prevented by ordinary adult reference ranges.
- **Missing is displayed as normal:** `VitalSignTable.jsx` returns the green success class for missing and nonnumeric values. Show Not recorded / Invalid as neutral states. Keep visible text or symbols alongside color. Zero must not disappear through truthiness checks.
- **Reference context:** the display applies fixed adult-like ranges without age or clinical context. A single set of colors should not imply clinical reassurance for all ages or conditions. Have the clinical team approve reference policies and escalation rules before implementing decision support.
- **Workflow:** all current entry fields are required; the reviewed record does not explicitly capture why a measurement was not obtained or link observations to a consultation. Support deliberate partial observations with reasons and clear units; retain patient, observer, observed-at time, encounter and correction history. Consider weight/height and other observations according to the facility's actual clinical scope.
- **History:** the query lacks deterministic ordering before pagination; date filters require both endpoints. Add latest-first ordering, validated date filters, stable pagination and a clearly labelled latest measurement timestamp. Keep historical observations distinguishable from current observations.
- **Access:** vital creation accepts `employeeid` from the body; read uses patient ID without a care-relationship check in its handler. Derive the observer from the session and apply the same patient-access policy as consultation history.

## Recommended implementation order

1. Stop blanket credential updates and close author/record-scope vulnerabilities; verify with negative authorization and isolation tests.
2. Establish practitioner identity, patient access and encounter lifecycle shared across laboratory, facility and pharmacy contexts.
3. Add invitation/access administration using the patient portal patterns.
4. Correct vital persistence, validation, missing-data display and observation history.
5. Rebuild the consultation workbench around the actual care flow, then test external referral, internal consultation and pharmacy consultation end to end with representative roles and devices.

## Package change delivered

A dedicated read-only page at `/billing/packages/[packageid]` shows test panels, base/final prices, discounts, organizations and clinicians. The package list has View for staff; New, Configure and Delete require administrator/manager roles. Direct navigation to the editor is restricted too. API middleware protects both new configuration endpoints and legacy package mutations; the staff billing lookup remains available as a read operation. Existing module boundaries still apply. This does not grant external portal accounts permission to browse facility configuration.

Validation: 13 isolated browser checks and 19 middleware/persistence tests passed. The browser fixture does not access production data. Full application type checking remains subject to the pre-existing errors recorded in the task output; it is not a clean production build.
