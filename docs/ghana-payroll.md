# Ghana payroll setup

Ghana setup is available from Payroll → Tax Configurations → Ghana payroll setup, to the existing administrator/super-administrator and accountant configuration roles. New APIs independently verify the authenticated tenant and role; body identities are not used for audit ownership.

## Shared PAYE configuration

Selecting Ghana previews verified GRA progressive bands. Saving creates or reuses one effective-dated record in `payroll_tax_configuration`, linked by `payroll_country_setup.tax_configuration_id`. The existing Tax Configuration list and details show that same record, its seven parsed bands, effective dates and GRA preset status. Calculation loads bands and statutory rule data from the linked record; the country wizard is not a separate hidden PAYE store. The published GRA preset is protected from in-place mutation; custom legacy configurations remain editable through their existing workflow.

Bootstrap and the migration repair previously saved Ghana setups which had no link. Existing tax configurations are retained, including older records for the same year. Uniqueness is applied to the statutory rule version instead of the tax year. Repeated setup does not create more PAYE records, generic deduction definitions or employee deductions. The legacy global tax path excludes managed Ghana presets; the normal active-configuration API resolves the configured Ghana preset when effective.

## Verified package and limits

The initial package supports full calendar-month, monthly GHS payroll for September–December 2026. Earlier periods retain their existing configuration. Unverified dates, partial months, other frequencies, and hourly/commission-only payroll without defined monthly basic salary are rejected rather than silently treated as compliant. Rule updates require a new reviewed version. Ghana salary calculations select compensation effective for the entire payroll month, including historical salary records; mid-month salary changes without a complete period record are held for review. Approval, locking, payment and reversal remain in the existing payroll workflow. Saved finalized payroll is never recalculated by setup.

Official sources checked 29 October 2026:
- https://gra.gov.gh/domestic-tax/tax-types/paye/
- https://www.ssnit.org.gh/faqs/
- https://www.ssnit.org.gh/wp-content/uploads/2026/01/Public-Notice-Min-Max-Insurable.pdf
- https://www.bcp.gov.gh/acc/registry/docs/BASIC%20NATIONAL%20SOCIAL%20SECURITY%20SCHEME%20REGULATIONS%2C%202011%20%28L.I.%201989%29.pdf

Employee mandatory contribution is 5.5% of basic salary; employer contribution is 13%. Tier 1 is limited to the published SSNIT maximum; the remaining combined mandatory contribution goes to Tier 2, rather than capping all pension contributions or charging Tier 2 again to the employee. Employer top-ups cover the published minimum SSNIT remittance. Existing Tier 3 enrollment is preserved, with unsupported above-limit treatment blocked for review. No additional NHIS charge is generated from SSNIT's internal allocation.

## Calculation, eligibility and duplicate handling

Non-taxable allowances/bonuses remain paid but are excluded from taxable income. Eligible employee pension contributions are taken before PAYE. Employer pension costs are added to employer cost. Residency, approved exemptions, approved monthly reliefs and employee profile data are honored. Dependants are recorded but do not automatically grant unapproved reliefs. Bonus concessions require reviewed annual basic salary and opening taxable bonuses before the activation month; subsequent payroll snapshots supply additional year-to-date bonuses. Junior overtime concessions require verified qualifying annual income. Nonresident special bonus/overtime treatment is separate from regular PAYE.

The wizard previews matched existing PAYE/SSNIT/pension/NHIS definitions and employee deductions. On confirmation their IDs are mapped and skipped by Ghana calculation; the records are not deleted. Ordinary loan/advance repayments are preserved. A newly introduced unmapped statutory duplicate blocks calculation until the setup mapping is reviewed.

Decimal arithmetic with explicit cent rounding is used for the Ghana calculation. Each payroll snapshot records exact bands, tax components, rule version, setup version, PAYE configuration ID and pension allocations. Accounting credits SSNIT, Tier 2 and Tier 3 separately. Pension allocations plus PAYE, other deductions and net pay reconcile to salary expense and employer contributions.

Setup does not register employees with authorities, file returns, pay pension providers, grant tax exemptions automatically, or alter financial authorization. Employee-specific approvals and registrations remain the facility's responsibility.

## Verification

`src/services/payroll/GhanaPayroll.test.ts` covers bracket boundaries, zero income, pension ceilings/minimums, bonus/overtime eligibility, nonresident treatment, repeated setup, old-year record preservation, shared-record backfill, tenant/role denial, actor audit, finalized-period protections, calculation snapshots, duplicate suppression and balanced accruals.

`scripts/test-ghana-payroll-browser.cjs` exercises rule auto-fill, required registrations, preview/confirmation, request failures, employee search/approval requirements, stale-profile protection, role visibility, mobile layout, linked PAYE navigation and the existing Tax Configuration list. All browser writes are intercepted; no live payroll is calculated or paid by this test.
