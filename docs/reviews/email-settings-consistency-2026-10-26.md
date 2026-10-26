# Email and application settings consistency review — 26 October 2026

## Critique and fixes

1. Email dialogs were rendered through a portal outside the page's style scope. They reverted to different fonts, buttons and control sizes. Added an explicit shared dialog class for provider/template/queue/log dialogs, honoring the configured application font, green primary actions, 40px controls, restrained headings and visible keyboard focus.
2. Settings styles contained repeated conflicting definitions. Consolidated the rules into one readable module using the billing-strategy/commission palette, spacing, weights and action hierarchy. Report field rows now align consistently and stack on small screens. Checked switches use the primary green.
3. Some actions remained icon-only or used unrelated blue accents. Provider refresh, connection-test and deletion actions now have visible text; secondary actions use the neutral style. Simplified provider and delivery descriptions. Metric grids fit their actual content.
4. Report field labels were often visual text without a matching control. Connected report-tab labels and email form labels to stable control IDs. This improves click targets, keyboard/screen-reader navigation and reliable form testing.
5. Nested report settings handled checkbox `value` rather than `checked`. Company/patient/comments checkbox paths now retain boolean state; other value types and the save envelope are unchanged.
6. Provider saves could be repeated and email APIs could return false success. Added an in-flight guard, disabled editing/closing while saving, inline failed-save messages and retained entries. Shared email response helpers now reject explicit failed envelopes. Provider loading has an inline retry, and password visibility resets between records.

## Validation

`scripts/test-settings-ui-polish-browser.cjs`: 19 grouped Edge browser checks pass, using actual pages/report tabs/PrimeTable and synthetic API/context. Covers all earlier workflows plus report boolean persistence, real portal fonts after changing application font, green Save button color/40px height, provider failed/successful saves without duplicate writes, password reset between records, provider retry and mobile dialog fit. All 13 settings/email/marketing views fit a 390px viewport without page overflow. No runtime/hydration errors. Desktop/mobile screenshots reviewed under `tmp/settings-ui-polish/browser-17468`.

Full frontend TypeScript check: `tsc --noEmit --incremental false`, output `tmp/settings-ui-polish/types-complete.log`. No live email sends or settings/pricing/marketing writes were performed by the checks. Authorization, billing rules and backend contracts were preserved. The harness replaces transport/context and unrelated sample dialogs/date helpers/Next routing, so this is not a live-backend authorization test.
