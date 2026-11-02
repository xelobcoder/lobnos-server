# Pharmacy interactive guides implementation

## Approach

Replace the condensed article with a typed article catalogue and a reusable documentation reader. Author task-specific content against actual routes and controls; do not generate instruction pages from titles alone.

## Implementation sequence

1. Finish cash/day-closing safeguards and focused tests.
2. Build the article reader, role-aware index and accessible search.
3. Add accounting articles first, then purchasing, stock, sales, reports and onboarding.
4. Connect contextual help to the corresponding article.
5. Offer optional walkthroughs for purchase requests, receiving, expenses, customer balances and income statements.
6. Validate routes, article shape, permissions, navigation, walkthrough safety, financial failure states and responsive rendering.

## Walkthrough contract

Highlight existing controls without clicking them. Never invoke a mutation or fill, submit, approve, pay or post a form. Each step explains what the reader may do manually. Controls not currently mounted get an explicit instruction, not a fabricated success. Support next/back, dismiss and restart; Escape dismisses. Highlighting must not move forms or discard drafts.

## Illustrations and validation

Use annotated schematic examples labelled as illustrations, never screenshots of invented live data. Actual screenshots, if used, must come from the isolated fixture and be labelled accordingly. Source/API inspection, automated browser tests and representative-user testing are distinct evidence levels. Track completed articles and verified workflows in the audit; list unavailable features or uncertain behavior explicitly.
