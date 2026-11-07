# Test Panel Manual: Internal Evidence and Gaps

## Scope and verification limit

- Product: Prime Laboratory Software (PLS)
- Frontend package version: `1.0.0`; source revision reviewed: `4a9e4ebe`
- Backend source revision reviewed: `bc5623d5`
- Access available: source repositories and an unauthenticated local site that redirects to sign-in. No authorized training account or demo data was available for an executed walkthrough.
- Reader-facing procedure: `P-OPS-001`, “Create a test panel, parameters and references.”
- Verification status: **Verified (source)**. This status describes static inspection only, not a successful live workflow.

## Evidence register

| Procedure ID | Route / screen | Component or file | Backend handler | Permission | Status | Notes |
|---|---|---|---|---|---|---|
| P-OPS-001 | Operations → Laboratory → Test Panels; Test Details; Test Fields; Calculations; Procedure Manual; Literature; Outsourcing; Critical-value actions; condition setup; Report Settings | `lobnos/app/settings/applicationsettings/testpanels/testlist/page.tsx`; `lobnos/app/settings/applicationsettings/testpanels/multiple-test-conditions/[testid]/page.tsx`; `lobnos/app/settings/applicationsettings/testpanels/multiple-test-conditions/[testid]/[conditionid]/page.tsx`; `lobnos/components/settingsComponents/TestPanelStaffAccess.tsx`; `lobnos/components/settingsComponents/FieldsCreation/createfieldsComponent.tsx`; `lobnos/components/settingsComponents/FieldsCreation/MultiFieldConditions.jsx`; `lobnos/components/operations/TestOperationalSettings.tsx` | `lobnos-server/src/controllers/testpanel/routes.ts`; `lobnos-server/src/controllers/operations/route.ts`; `lobnos-server/src/controllers/operations/operationalControlRoutes.ts`; panel editor, calculation, and `CriticalActionService` handlers | View, manage, and delegation middleware in `lobnos-server/src/middleware/testPanelAuthority.ts`; deletion is checked by `requireSuperAdminTestPanelDeletion`; critical settings and outsourcing providers require laboratory supervisor authority | **Verified (source)** | The requested local page redirected to sign-in. No protected Test Panel screen was accessible and no changes were saved. |

### Permission findings

- Administrators can view and manage test panels. Administrators and managers can delegate access, subject to the branch rules enforced by the access handler.
- Delegation is limited to staff with eligible scientist assignments. A manager can delegate only to an eligible scientist assigned to the manager's branch.
- The permission is assigned to the staff member, but panel access is evaluated against the active role and branch. Staff with more than one role must use an assigned scientist role for that delegated permission to apply.
- `Manage tests` requires `View page`; the interface also sets view access when manage access is selected.
- Delegation does not grant deletion. The delete handler checks that the active role and the persisted staff role are both super-admin roles.
- Condition creation and validator changes require test-panel management access. Saving critical-value actions and outsourcing-provider settings requires laboratory-supervisor authority (administrator or manager).
- The test editor displays the Critical-value actions and Outsourcing tabs only to administrator roles, although the corresponding save services also allow managers with laboratory-supervisor authority. A manager with panel-management permission cannot reach these settings through the inspected editor UI; confirm the intended role behavior and reconcile it.
- These are source findings. Confirm the role labels and full end-to-end behavior in a running training environment before treating them as executed.

### Panel configuration findings

- The test creation form uses `Test Name`, `Add Row`, and `Add Tests`; an empty name is rejected with “Test names cannot be empty.”
- The editor has separate tabs for Test Details, Test Fields, Calculations, Procedure Manual, Literature, Outsourcing, Critical-value actions, and Report Settings.
- Adding a field updates the editor draft. `Apply order` updates the draft order; `Save All Changes` persists the fields and order.
- The field editor includes Dropdown, Text, Reference, Range (M/F/Child/Neonate), Fetal Biometry (Hadlock), Compare, Compare (<=/>=), Text Area, Time, Ultrasound, Date & Time, and Date plans.
- The field editor reports “Field name is required” when the name is missing and “Please select a field type” when no plan is selected.
- Outsourcing and Critical-value actions appear only for administrator roles in the inspected editor.
- Critical-value policies apply to existing condition rules. The policy controls acknowledgement, clinician communication records, report-printing holds, electronic-release holds, and supervisor clearance. A policy change requires a reason.
- Condition validators include Less than value, Greater than value, Match value, Does not match value, and In range of two values. Numeric targets are required for less/greater and ranges; range endpoints are entered with a hyphen.

## Screenshot manifest

No Test Panel screenshots are captured. Replace each placeholder only with an application screenshot from the matching documented edition, using a training environment and fictional data.

| Figure | Screen and state needed | Status |
|---|---|---|
| Figure 1 | Test Panels list with the new-test form open; training account authorized to manage test panels | Pending |
| Figure 2 | Test Details editor populated with fictional, non-clinical training data | Pending |
| Figure 3 | Test Fields and Arrange parameters with fictional fields in an unsaved reordered draft | Pending |
| Figure 4 | Staff Access table showing fictional scientist access choices | Pending |
| Figure 5 | Critical-value actions for a fictional rule, with an unsaved policy and training-only reason | Pending |
| Figure 6 | Condition name and validator editor with a fictional parameter and placeholder target | Pending |

## Documentation gaps

| Severity | Gap | Required follow-up |
|---|---|---|
| High | No executed walkthrough confirms the menu path, save behavior, role switching, or persisted field order in the running application. | Walk through creation, field entry, reorder/save/reopen, and delegated access in a training environment. |
| Medium | The editor exposes Outsourcing and Critical-value actions only to administrators, while their save services also permit managers with laboratory-supervisor authority. | Confirm the intended access matrix and either align the editor visibility or document the supported administrator-only workflow consistently. |
| Medium | Genuine Test Panel screenshots are unavailable. | Capture Figures 1–6 with fictional data and add captions, alt text, and numbered callouts matching the procedures. |
| Medium | TAT Count, Pre Tat, Tat, and Post Tat timing semantics are not clear from the inspected labels. | Confirm their local operational meaning with the laboratory owner before documenting specific timing guidance. |
| Medium | The manual's worked examples intentionally contain no clinical reference values. | The facility must supply and approve test-specific names, units, ranges, thresholds, options, formulas, and review criteria. |

## Publication check

The in-app and PDF Test Panel procedures are reader-facing. Routes, source file paths, handler names, revision traceability, verification status, and these documentation gaps belong only in this internal record. Figures remain explicitly pending until genuine application captures are available.
