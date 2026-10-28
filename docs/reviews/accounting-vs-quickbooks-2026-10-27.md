# Accounting review against QuickBooks Online — 27 October 2026

## Scope and conclusion

Reviewed accounting posting, period control, financial reporting, bank reconciliation, payment allocation and Cash Collection source code. Compared documented QuickBooks Online capabilities; availability varies by country, bank and subscription. This is a source review plus synthetic Cash Collection tests, not a certification of production balances or Ghana tax compliance.

PrimeLabSys has a substantial accounting foundation: chart of accounts, double-entry journals, general ledger, trial balance, income statement, balance sheet, cash-flow reporting, receivable/payable aging, bank statement imports and matching, manual journals, period/year/day closing, authority controls and an accounting outbox health view. It should not be described as lacking accounting altogether. The main weakness is reliability and consistency across these features.

## Priority findings

| Priority | Finding and source | Impact and recommended action |
|---|---|---|
| High — fixed in this patch | Cash Collection independently rounded each proportional waiver and payment (`lobnos/app/billing/cash-collection/page.tsx`, `applyGlobalWaiveOff`). | An entered 48.50 waiver became 48.49 and collection became 100.01. Allocate whole pesewas with largest remainders and derive payment from the balance less its allocated waiver. Added reusable `lib/billing/allocateWaiver.ts`; summary payment/waiver sums now use minor units. Removed the five-pesewa overpayment tolerance from row validation. |
| High — remaining | Central posting permits an absolute debit/credit difference up to 0.01 and rounds totals before persisting unnormalised line amounts (`AccountingService.ts`, `postTransaction`). | A journal may be accepted despite a one-pesewa difference, or database line rounding may disagree with aggregate rounding. Validate each amount/direction at the boundary, normalise to currency precision, require exact minor-unit equality, and test stored-line totals. |
| High — remaining | Historical receivable aging filters invoice date but reads the current `billing.outstanding`. Payable aging filters receipts by cutoff but subtracts completed supplier payments without a payment-date cutoff (`AccountingReportService.ts`, `receivableAging`, `payableAging`). | A payment today can change last month's aging. Reconstruct balances from dated invoices, allocations, refunds, credits and write-offs as of the cutoff. Reconcile the resulting subledger totals to control accounts. |
| High — remaining | Payable aging only enumerates inventory purchase receipts, and emits `partyId: null` despite selecting supplier ID (`AccountingReportService.ts`, `payableAging`). | This report cannot represent all expense/payable obligations or reliably drill into the supplier. Include every AP source and preserve supplier identity; document scope until complete. |
| High — remaining | Cash-flow reporting proportionally allocates entry net cash across counterpart amounts, independently rounds each share, then derives closing cash from those allocated categories (`AccountingReportService.ts`, `cashFlow`). | Categories can lose/gain pesewas. Compound journals can also be misclassified by generic weighting. Use exact allocation, explicit cash-flow mappings and actual closing cash from the ledger; expose and block unexplained reconciliation differences. |
| High — remaining | Payment processing accepts a total difference up to 0.01, silently clamps negative resulting outstanding to zero, and has optional rather than universally required idempotency (`models/payments/multi-payment.ts`, `processPayment`). The shown service fetch does not lock rows. | Stronger server-side invariants are required even after the UI fix: exact payment and waiver totals, service/bill identity, positive precision-checked values, current-balance limits under locks and idempotent retries for ordinary cashier requests. Test concurrent collectors and repeated submissions. |
| High — remaining | Posting checks period status before starting its own transaction; period closing separately reads totals and updates status (`AccountingService.ts`, `AccountingPeriodService.ts`). | Closing and posting can race. Use one transaction/consistent period locking protocol shared by close and posting. Existing role/authority controls should remain. |
| High — remaining | Bank reconciliation `match` checks whether another statement line uses the journal ID, then updates the supplied statement ID. It does not itself validate that both records exist, belong to the same bank account, have equal signed amounts, or are suitable for matching (`BankReconciliationService.ts`, `match`). | Automatic suggestions are helpful but cannot replace checks on manual matching. Validate both records under a transaction and enforce unique matching in the database; reject cross-account/unequal matches and retain a history of unmatches. |
| Medium — remaining | Reversal posting and marking the original reversed are separate operations when no caller transaction is supplied (`AccountingService.ts`, `reverse`). | A failure between the operations can leave inconsistent status. Wrap the reversal lifecycle in one transaction with retry-safe identity. |

These findings concern observable implementation paths. Their production financial impact needs reconciliation against actual transaction history; no production records were changed by this review.

## Comparison with QuickBooks Online

| Area | PrimeLabSys assessment | QuickBooks comparison and practical gap |
|---|---|---|
| Healthcare operations | Patient/test billing, NHIS workflows, pharmacy and cashier workflows integrate with operational records. | A useful domain advantage. Preserve it while strengthening posting invariants; QuickBooks is the general accounting benchmark, not the replacement specification for clinical workflows. |
| Ledger and reports | Broad functionality exists; precision and temporal-report defects remain above. | Having report pages is insufficient: numbers must reconcile at a historical cutoff and from source transaction through ledger. |
| Accounting basis | Reviewed report service has fixed query semantics; no cash/accrual basis parameter found in those methods. | QuickBooks supports selecting cash or accrual on reports. Explicitly label the current basis; implement alternate basis only with consistent allocations and tests. |
| Banking | Bank account configuration, CSV/Excel imports, deduplication, matching and unmatched balances exist in `BankReconciliationService.ts`. | QuickBooks offers automated bank feeds where supported. No equivalent live feed was identified in the reviewed service. Ghana bank availability must be checked separately. Prioritise statement reconciliation evidence before integrations. |
| Audit evidence | Created-by fields, authority workflows and operational records exist. Period status updates overwrite current close metadata. | QuickBooks provides a consolidated who/when/change-history audit log. A complete immutable before/after history for period reopen/close was not established in the reviewed accounting paths. Verify global audit coverage and add a linked accountant-facing history where absent. This is a coverage gap to verify, not proof that the entire application has no audit trail. |
| Close and reliability | Period controls, finalization services, outbox retries and health visibility exist. | Improve atomic close enforcement and reconcile all source modules before final statements. Do not hide failed posting jobs or treat operational totals as necessarily equal to the GL. |

## Important nuance: waivers

MultiPayment creates automatic Bad Debt expense records for waivers. However, `ExpenseAccounting.ts` explicitly excludes module-owned Bad Debt categories from normal expense posting. Therefore this review does **not** claim that each waiver double-posts cash to the GL. The operational designation as a paid expense still warrants a separate trace through expense reports, cash summaries and source-specific accounting before any reclassification.

## Validation

- Allocation unit checks cover the supplied 38.50/55.00/55.00 example, deterministic ties, zero balances, full waiver/capping, invalid arguments and every whole-pesewa waiver from 0 through 148.50.
- Real Cash Collection component browser tests use synthetic transport only, including direct/separate cashier workflows, partial payments, receipts, summary totals, mobile layout and the reported three-service allocation.
- Full frontend TypeScript check passed (`tsc --noEmit --incremental false`). Browser suite passed 17 checks; exhaustive allocation checks passed.
- No authorization changes, database migrations or historical balance adjustments.
- Remaining audit findings above were not silently rewritten as part of this precision fix.

## Official Intuit references

- Cash/accrual methods and report selection: https://quickbooks.intuit.com/learn-support/en-us/help-article/product-preferences/choose-cash-accrual-accounting-methods-reports/L64yocn6B_US_en_US
- Audit log: https://quickbooks.intuit.com/learn-support/en-global/help-article/audit-log/use-audit-log-quickbooks-online/L2WoVnW6I_ROW_en
- Bank feeds and institution availability: https://quickbooks.intuit.com/global/bank-feeds/

## Remediation follow-up

The correctness findings above were addressed in the subsequent accounting patch. See [Accounting corrections and verification](accounting-remediation-2026-10-27.md) for the per-finding resolution, test evidence, deployment requirements and limits of live-data verification. The original findings are retained here as the review record.
