# Reusable salary templates

Payroll → Salary Templates lets existing payroll configuration roles (administrator, super-administrator and accountant) save reusable compensation terms. Each tenant has its own templates and version audit. A template can contain salary/hourly/commission terms, currency, pay frequency, overtime multiplier and an optional salary-level/grade reference selected from the existing Salary Grades list. Selecting a grade initializes its currency; template salary must fit its range. The grade carries into employee compensation when applied. Salary grades remain ranges/role mappings; templates are reusable compensation defaults.

Create a template once, then choose it in Create Compensation and explicitly click Apply template. Review the employee's individual terms, effective dates, payment method and payment account before saving. Applying a template does not create compensation until the existing form is submitted. Employee identities, dates and payment accounts are never stored in templates. Switching employees clears previous payment-account inputs while keeping reusable salary terms.

The existing compensation POST validates that the selected template is active and its version is current, applies validated defaults, and records an immutable server-owned source snapshot. Authorized per-employee overrides remain possible. Template edits do not update existing employee compensation. Inactive templates remain available for audit but cannot be newly applied. Source metadata cannot be rewritten through compensation updates.

Saving template changes uses optimistic version checks and a template audit record bound to the authenticated actor. Template and compensation writes remain tenant scoped, and the existing payroll configuration role gate is used. The compensation creation transaction locks the employee and selected template before applying the normal compensation/grade validation and active-record rules. Manual compensation creation remains supported.

Schema is installed by payroll bootstrap and migration `20261029_salary_templates`. Existing compensation records are retained with nullable template metadata. Neither setup nor automated tests assign templates to live employees, calculate payroll, or pay salaries.

Verification: `src/models/payroll/SalaryTemplate.test.ts` and `scripts/test-salary-templates-browser.cjs` cover reuse, independent employee records, stale/inactive templates, snapshots, ordinary manual creation, role/tenant restrictions, private payment fields, failed saves and responsive UI.
