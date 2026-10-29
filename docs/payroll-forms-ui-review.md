# Payroll forms compared with billing strategy

The reference is the existing StrategyEditor.tsx and StrategyWorkspace.module.css,
not a new visual pattern imposed on the billing screens.

| Billing strategy pattern | Payroll weakness | Implemented change |
|---|---|---|
| Clear header, grouped editor and review column | Narrow cards, misplaced headers, inconsistent form sections | Shared payroll editor layout; numbered sections; aligned headers; review columns for compensation, attendance, salary levels and payroll periods |
| Searchable selection | Long employee dropdowns in core forms | Search by name, role or employee ID in compensation and attendance; existing employee field and handlers retained |
| Read-only review before saving | Dates/status/payment context scattered or absent | Live summaries; effective dates in compensation; clocked hours in attendance |
| Clear save area and desktop review action | Save buttons buried in sidebars; an initial sticky implementation covered fields | Footer never overlays editable fields; optional desktop review save action; consistent cancel/save placement |
| Disabled editor during save | Only the submit button was disabled | Eleven full-page forms and six inline/modal forms lock fields during submission |
| Unsaved-change protection | Cancel/back could silently discard input | Keep editing / discard dialog and before-unload protection on ten create/edit screens; custom back action preserved |
| Accessible labels and error feedback | Unlabelled controls, ambiguous tax-band inputs, unfocused errors | Labelled controls and band rows, required indicators, announced/focused form errors |
| Structured financial data and details | Payroll history had eleven loosely aligned columns and crowded detail modals | Seven financial columns, right-aligned GHS figures, page-local filter, explicit custom page-size Apply, accessible breakdown drawer |
| Compact summary cards | Leave/attendance summaries were fragmented icon-heavy boxes | One coherent summary strip with restrained status colors |

## Specific attendance corrections

- Blank late/overtime fields now submit numeric zero, matching the existing backend validator.
- Single, edit and bulk entry share the same payload normalizer.
- Clocked hours are sent as total_hours; overtime is already part of this duration.
- HH:MM and HH:MM:SS parse correctly, including midnight. Overnight durations require the existing night-shift selection.
- Overtime exceeding clocked hours and missing overtime approvers receive actionable errors.
- Absent records submit zero hours and no clock values; irrelevant fields are disabled.
- Early departure uses the backend's supported status; leave requests remain in Leave Management.
- The attendance list no longer adds overtime to worked hours or calls a nonexistent summary route.
- Summary figures come from the visible loaded records. Search includes employee names.
- Filters use clear Apply/Reset controls with an explicit explanation of loaded-record versus server filters.

## Coverage and limits

Thirty-four legacy payroll routes received the shared screen treatment in addition to the
five pages already using the newer layouts. This is source coverage, not a claim that
every production state on all routes was exercised.

Actual-component browser checks cover ten create/edit/inline form screens on desktop and
390px mobile, live grade/period review, searchable employee selection, unsaved changes,
field locking, failed-save retention, single/bulk attendance payloads, history table
filtering/pagination/drawer, leave summaries and attendance hours. All writes are intercepted.
The attendance contract test also runs the production repository validator with a fake
database sink: the original null-number payload fails, while corrected regular, absent
and overnight payloads pass. No live records are changed.

Payroll calculation formulas, role policy and backend authorization were not changed by
this frontend work. Desktop/mobile screenshots use isolated fixture data.


Final requested-page checks passed: ten form screens on desktop/mobile, single and
bulk attendance saves, populated history-table filtering/custom page size/pagination,
keyboard-accessible breakdown drawer, leave summary strip, corrected attendance hours,
salary-template reuse, Ghana setup, payroll processing and full frontend type checking.
Screenshots were inspected and overlapping save controls were removed. No live writes
were performed.
