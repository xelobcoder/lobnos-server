# Hubtel Payroll UI Design System

Design guidance inferred from the provided payroll-management and employee
wallet screenshots. Treat visual measurements and color values below as
starting estimates: screenshots are scaled/compressed and are not source design
files. The system describes the shown product surfaces; it does not claim to be
Hubtel's official brand specification.

## 1. Product surfaces

The reference material shows two related experiences:

1. **Employer / payroll administration (desktop-first):** branch navigation,
   payroll setup, employee join requests, beneficiary salary entry, pay-run
   review, and transfer approval.
2. **Employee wallet (mobile-first, with desktop support):** wallet balance,
   payments and payslips by month, transaction details, and withdrawals or
   transfers to a named account.

Share brand colors, typography, money formatting, status language, and
interaction behavior across the experiences. Do not force the administrator's
dense tables into the employee's compact mobile interface.

## 2. Visual principles

- **Finance should feel calm and legible.** Use spacious white surfaces and
  restrained color; reserve saturated teal for primary actions and active
  states.
- **Put the decision before the action.** Show totals, recipients, dates,
  deductions, and destination details before an irreversible payment,
  approval, or withdrawal.
- **Make the next step obvious.** Use clear page titles, section tabs, concise
  helper text, and a single visually dominant primary action per decision
  area.
- **Use color as reinforcement, never as the only cue.** Pair status colors
  with readable labels and icons/text.
- **Progressive disclosure for detail.** Group payslips by month; expand a
  month or transaction to show its constituent payments.
- **Protect sensitive actions and information.** Treat payroll codes and
  employee identifiers as confidential; explain sharing and withdrawal
  constraints in context.

## 3. Design tokens

The following hex values are approximate visual matches from the screenshots.
Confirm them against approved brand assets before implementation.

### Color

| Token | Approximate value | Usage |
| --- | --- | --- |
| `navy-900` | `#0B2F4B` | Employer sidebar background |
| `navy-950` | `#06243A` | Sidebar selected/pressed item |
| `teal-700` | `#087F7A` | Primary buttons, active tabs, links |
| `teal-600` | `#0B9B93` | Wallet header, primary emphasis |
| `teal-100` | `#DDF4F1` | Soft selected/positive backgrounds |
| `purple-600` | `#7138C8` | Product/organization mark accent |
| `neutral-0` | `#FFFFFF` | Cards, tables, main content |
| `neutral-50` | `#F7F9FB` | Application canvas |
| `neutral-100` | `#EFF3F6` | Table headers, subdued banners |
| `neutral-200` | `#DCE3E8` | Borders, dividers |
| `neutral-500` | `#71808C` | Secondary text, muted controls |
| `neutral-700` | `#394750` | Body text |
| `neutral-900` | `#171D22` | Primary text and financial values |
| `info-50` | `#EAF4FF` | Informational notice surface |
| `info-700` | `#2563A7` | Informational text and icon |
| `warning-50` | `#FFF5E8` | Warning notice surface |
| `warning-700` | `#A85B11` | Warning text and icon |
| `success-700` | `#17845B` | Completed/ready status |
| `danger-600` | `#C83D4B` | Decline, block, destructive actions |

**Contrast:** Body and action text must meet WCAG AA contrast. In particular,
use white or another verified high-contrast foreground on teal/navy buttons;
do not copy low-contrast pale text from a scaled screenshot.

### Typography

- Use the product's existing sans-serif stack where available; otherwise use
  a system UI sans-serif stack.
- Page titles: approximately 20–24 px, semibold.
- Section headings: approximately 15–18 px, semibold.
- Body and table content: approximately 13–15 px, regular.
- Helper labels and secondary metadata: approximately 12–13 px, with verified
  contrast and comfortable line height.
- Financial amounts should use tabular numerals where supported. Align
  currency values consistently, preferably right-aligned in tables.
- Keep button labels short, sentence case, and explicit: “Approve transfer”,
  “Confirm”, “Decline”, “Withdraw”.

### Spacing, shape, and elevation

Use a consistent 4 px spacing base. Suggested scale: 4, 8, 12, 16, 24, 32,
40 px. Favor a compact but breathable density on desktop finance tables.

- Cards and panels: white background, 1 px neutral border, 8–12 px radius.
- Inputs and compact buttons: 6–8 px radius.
- Pills and avatars: fully rounded.
- Use subtle shadows only for floating layers such as menus, dialogs, and
  drawers; cards generally rely on borders rather than heavy elevation.
- Separate sections using whitespace and thin neutral dividers, not repeated
  heavy outlines.

## 4. Application shell

### Employer desktop shell

- Persistent dark navy left sidebar with organization mark/name, branch
  selector near the top, primary navigation, and settings anchored near the
  bottom.
- Main workspace uses a white top bar and a light neutral content canvas.
- Top bar contains page context, global “Create new” action, notifications, and
  user/account menu.
- Payroll navigation is presented as a horizontal secondary tab row:
  **All Accounts & Transfers**, **Pay an Account**, **Payroll**, and
  **Approve Transfers**.
- Indicate the current section using a teal underline or similarly clear
  selected state; “New” is a small, readable badge rather than a competing
  button.
- At narrower widths, collapse the sidebar to a drawer or compact icon rail;
  preserve access to the branch selector and current module.

### Employee wallet shell

- Mobile-first top bar in teal, with page title and compact account/profile
  controls.
- Persistent bottom navigation for **Withdrawal account** and
  **Withdrawal history** on narrow screens.
- Use a centered, constrained workspace on desktop. Keep wallet balance,
  employer identity, and payment history visible without requiring excessive
  navigation.
- Use safe-area insets for fixed mobile headers, drawers, and bottom navigation.

## 5. Reusable components

### Navigation

- Sidebar item: icon plus label, generous click target, subtle hover, strong
  active background and contrasting text.
- Branch selector: clearly labels the active branch and whether “All Branches”
  is selected; keyboard accessible.
- Tabs: text labels, persistent active underline, visible keyboard focus.
- Notification count: small badge with an accessible name and non-color-only
  meaning.

### Buttons

| Variant | Use |
| --- | --- |
| Primary filled teal | Main forward action: pay, confirm, approve, withdraw |
| Secondary outlined teal | Supporting action: download, upload, copy |
| Tertiary text | Low-emphasis actions such as “Manage code” |
| Destructive outlined/filled red | Decline, block code, or other destructive action |

Buttons need disabled, loading, hover, focus, and pressed states. Disable
actions only when the reason is visible. A disabled payroll action should be
paired with guidance explaining what is missing, such as salaries not yet being
set.

For bulk actions, distinguish “Confirm all” from row-level “Confirm”; show the
number of affected requests and require confirmation when the operation is
irreversible.

### Notices and status

- **Info:** pale blue panel, info icon, concise next-step guidance.
- **Warning:** pale amber panel, warning icon, explicit consequence or risk.
- **Success/ready:** green status label or badge; retain text like “Ready”.
- **Pending:** neutral or amber label with clear “Waiting for approval” wording.
- **Rejected/blocked/failed:** red label and a human-readable reason when
  available.
- Never indicate an important status with color alone.

### Cards and summary metrics

Use summary cards for:

- Confirmed beneficiaries
- Requests waiting for approval
- Gross amount per pay run
- Net amount to beneficiaries

Each card should have a concise label, prominent value, and optional
explanatory sublabel. Use currency and decimal precision consistently.

### Tables

Use tables for employee records, join requests, beneficiaries, and transfer
reviews.

- Header row uses a lightly tinted neutral surface and clear labels.
- Keep row heights compact but readable; use subtle separators and hover
  highlighting.
- Align names/identifiers left, dates consistently, and money right.
- Place row actions at the far right, with an accessible button label instead
  of an unlabeled ellipsis alone.
- Inputs embedded in beneficiary rows need labels or accessible names, currency
  context, and validation feedback.
- Include pagination, page-size selection, and a clear “showing X–Y of Z”
  summary for long lists.
- On mobile, transform tables into stacked record cards or a deliberate
  horizontal scroller with clear affordance. Do not silently clip action
  buttons or key amounts.

### Payroll code panel

- Show code, active/expiry state, and remaining validity together.
- Provide **Copy code**, **Regenerate**, and **Block code** as distinct actions.
- Treat the code like a password: explain who may use it and that it should not
  be shared publicly. Avoid writing it to logs.
- Regenerate/block actions require confirmation and explain that pending
  requests may be affected.
- Ready-made email/WhatsApp/SMS copy should be selectable by channel. Make copy
  feedback immediate and announce success accessibly.

### Wallet and payslip history

- Wallet balance appears in a prominent teal card with user identity and the
  primary withdrawal/transfer action.
- Present payments grouped by month. Each month header includes the month,
  total, and expand/collapse control.
- Expanded months may show dated payment items and a final payslip summary,
  clearly distinguishing individual payments from their combined total.
- Include employer/organization mark, number of payments, period, gross/net
  values, and allowance/deduction breakdown when available.
- A downloadable payslip is a distinct final document action; provide a clear
  label and accessible download feedback.
- Mask sensitive identifiers by default when appropriate; provide an explicit
  reveal control with a clear accessible label.

### Withdrawal and transfer drawer

- Desktop: right-side drawer over a dimmed page; mobile: full-height sheet or
  full-screen flow.
- Show withdrawal amount and account ownership restriction before destination
  selection.
- Present destination methods as labeled selectable rows/cards with provider
  marks where available; do not make provider logos the only label.
- Make the selected method, account details, fees, and final amount explicit
  before submission.
- Provide a clear close/back control and preserve safe form progress when
  navigating between steps.
- Confirm completion with status and next-step guidance; prevent duplicate
  submissions while a transfer is processing.

### Transfer approval

- Put the total amount and requesting party above the recipient list.
- Each row includes recipient name, mobile, account identifier, description,
  and amount.
- Make **Approve this transfer** and **Decline this transfer** visually
  distinct; request confirmation before finalizing either decision.
- Approval review must show the exact total that will be transferred and the
  number of recipients. Avoid truncating amounts or relying on a tooltip for
  critical details.
- Show pending/approved/declined states and actor/time audit metadata after
  action.

### Empty, loading, and error states

- Empty table: explain why there are no records and provide the appropriate
  next action.
- Loading: keep layout stable; use skeletons for table/cards where helpful.
- Error: state what failed, whether data/action may have been saved, and a
  retry or support path.
- Partial failure: identify which rows/actions succeeded and which did not.
- Never display a success state when the server result is uncertain.

## 6. Interaction and content rules

- Use consistent currency formatting, including currency code/symbol and
  locale-appropriate grouping. The screenshots show GHS; do not hardcode GHS
  where an organization can configure another currency.
- Use explicit dates and time zones for payroll periods, approvals, and
  transfer history.
- Amounts must distinguish **gross**, **deductions**, **net**, **wallet
  balance**, and **transfer amount**.
- For salary entry, make bulk spreadsheet and inline editing complementary;
  validate imported data before applying it and preserve row-level errors.
- Confirm high-impact actions. The confirmation should restate the action,
  total amount, recipient count, and target period.
- Avoid ambiguous labels such as “Done” for a financial action. Prefer a
  specific outcome such as “Approve and pay” or “Return to payroll”.
- Make keyboard focus visible and keep modal/drawer focus contained until
  closed. Return focus to the trigger afterward.
- Announce asynchronous action progress and completion to assistive technology.

## 7. Responsive behavior

### Desktop (approximately 1024 px and wider)

- Full sidebar and horizontal payroll tabs.
- Summary metrics in a row, collapsing to fewer columns as workspace narrows.
- Full tables with inline salary fields, row actions, and pagination.
- Withdrawal flow may use a right drawer.

### Tablet (approximately 768–1023 px)

- Sidebar may collapse; keep branch and module context accessible.
- Summary cards form a two-column grid.
- Tables may scroll horizontally within their own region; keep first-column
  identity and action affordances usable.
- Drawers may take more viewport width.

### Mobile (below approximately 768 px)

- Prioritize employee wallet experience: compact teal header, stacked balance
  and payslip cards, fixed bottom navigation.
- Replace dense admin tables with record cards or purposeful horizontal
  scrolling.
- Keep primary actions reachable without hiding financial totals or warnings.
- Use at least 44 × 44 CSS px interactive targets where feasible.
- Respect device safe areas and ensure sheets/dialogs do not obscure their
  submit/close controls behind the keyboard.

Breakpoints are guidance, not fixed requirements; adapt to the actual content
and test at intermediate widths.

## 8. Accessibility and financial safety

- Target WCAG 2.2 AA for contrast, keyboard operation, focus indication, and
  semantics.
- Use semantic headings, buttons, labels, table headers, and status
  announcements.
- Give icon-only controls accessible names; decorative icons should be hidden
  from screen readers.
- Ensure all form fields have persistent labels; placeholders are examples,
  not labels.
- Describe disabled actions and validation errors in text.
- Support zoom/reflow without loss of important financial content or actions.
- Present money and dates without ambiguous truncation. Provide a way to inspect
  full details on smaller screens.
- Sensitive payroll codes, balances, and account identifiers should not appear
  in URLs, analytics events, or application logs.

## 9. Suggested implementation tokens

Example CSS custom properties for a consuming frontend. Values remain
provisional until checked against approved brand assets.

```css
:root {
  --color-sidebar: #0b2f4b;
  --color-sidebar-active: #06243a;
  --color-primary: #087f7a;
  --color-primary-strong: #0b9b93;
  --color-accent: #7138c8;

  --color-canvas: #f7f9fb;
  --color-surface: #ffffff;
  --color-surface-muted: #eff3f6;
  --color-border: #dce3e8;
  --color-text: #171d22;
  --color-text-muted: #71808c;

  --color-info-bg: #eaf4ff;
  --color-warning-bg: #fff5e8;
  --color-success: #17845b;
  --color-danger: #c83d4b;

  --radius-control: 0.5rem;
  --radius-card: 0.625rem;
  --space-unit: 0.25rem;
  --focus-ring: 0 0 0 3px rgb(11 155 147 / 28%);
}
```

## 10. Screenshot-derived layout references

- **Employer shell:** navy sidebar; white top bar; light neutral work area.
- **Payroll setup:** code and security guidance at left, message preview at
  right.
- **Join requests:** summary metrics and warning/info notice above request
  list; per-row and bulk confirm/decline actions.
- **Confirmed beneficiaries:** salary/withholding fields in table, totals above,
  spreadsheet upload/download actions near page title.
- **Transfer approval:** transfer total and decision actions above a recipient
  and amount table.
- **Employee wallet:** teal brand header, balance card, month-grouped payments
  and payslips, fixed lower navigation on mobile.
- **Withdrawal:** choose a destination in a right-side desktop drawer; retain a
  compact balance and history view on mobile.

