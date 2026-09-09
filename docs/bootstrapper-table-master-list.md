# Bootstrapper Table Master List

This document lists the database tables created, altered, or seeded by the application bootstrappers.

The main startup registry is `src/bootstrap/applicationStartup.ts`. Bootstrappers are intended to be idempotent and run per tenant.

## Application Startup Order

1. Inventory
2. Pharmacy
3. Prescriptions
4. Entity orders
5. Billing
6. Commission configuration
7. Expense category seeding
8. Notification definitions
9. In-app notifications
10. Login username and account schema updates
11. Email
12. Result-value analytics
13. Home collection
14. Accounting (isolated startup block)

## Bootstrapper Registry

### Inventory

Source: `src/models/inventory/InventoryBootstrapper.ts`

Creates:

- `inv_categories`
- `inv_units`
- `inv_storage_locations`
- `inv_suppliers`
- `inv_brands`
- `inv_inventory_items`
- `inv_inventory_templates`
- `inv_purchase_orders`
- `inv_purchase_order_items`
- `inv_inventory_template_items`
- `inv_purchase_order_receipts`
- `inv_inventory_transactions`
- `inv_consumption_history`
- `inv_packages`
- `inv_package_transactions`
- `inv_supplier_payments`
- `inv_supplier_payment_allocations`

Seeds or ensures defaults:
- Standard inventory categories, including `Pharmacy`

- `pharmacy_sales`




Creates:
- `package_assignments`


Creates:
- `commission_configs`
- `commission_assignments`
- `commission_default`





- `notification_templates`
- `notification_event_settings`
- `notification_template_versions`




Source: `src/models/auth/LoginUsernameBootstrapper.ts`
Does not create a new table. It updates existing tables when present:
- `roles`
- `clinicianscredentials`


- `email_providers`
- `email_queue`
- `emaillog` (legacy email log)



Alters existing tables when present:
- `test_ascension`
- `result_value_analytics_observations`
- `test_analytics_snapshot`
### Home Collection
Source: `src/models/operations/sample/HomeCollection/BootstrapHomeCollection.ts`
Creates:
- `home_collection_areas`
Seeds the default home-collection checklist rows.
### Accounting
Source: `src/accountingModule/services/AccountingBootstrapService.ts`
The accounting bootstrapper delegates to several schema initializers.
- `acc_bank_accounts`
- `finance_ledger`
## Maintenance Notes
 # Bootstrapper Table Master List

 ## Inventory

 - `inv_categories`
 - `inv_units`
 - `inv_storage_locations`
 - `inv_suppliers`
 - `inv_brands`
 - `inv_inventory_items`
 - `inv_inventory_templates`
 - `inv_purchase_orders`
 - `inv_purchase_order_items`
 - `inv_purchase_order_receipts`
 - `inv_inventory_transactions`
 - `inv_consumption_history`
 - `inv_packages`
 - `inv_package_transactions`
 - `inv_supplier_payments`
 - `inv_supplier_payment_allocations`

 ## Pharmacy

 - `pharmacy_sales`
 - `pharmacy_sale_lines`

 ## Prescriptions

 - `prescriptions`
 - `prescription_items`

 ## Entity Orders

 - `entity_orders`
 - `entity_order_lines`
 - `entity_order_decisions`

 ## Billing

 - `package_assignments`
 - `validated_billing_dates`

## Payroll

- `payroll_salary_grades`
- `payroll_tax_configuration`
- `payroll_tax_reliefs`
- `payroll_deduction_definitions`
- `payroll_cost_centers`
- `payroll_payslip_templates`
- `payroll_periods`
- `payroll_transactions`
- `payroll_employee_compensation`
- `payroll_employee_allowances`
- `payroll_employee_bonuses`
- `payroll_employee_attendance`
- `payroll_employee_leave`
- `payroll_employee_leave_balance`
- `payroll_employee_statutory_deductions`
- `payroll_employee_other_deductions`
- `payroll_employee_other_deduction_ledger`
- `payroll_employee_cost_center_allocation`
- `payroll_employee_payslip_access`
- `payroll_adjustments`
- `payroll_period_reversals`
- `payroll_period_errors`
- `payroll_audit_log`

 ## Commissions

 - `commission_configs`
 - `commission_tiers`
 - `commission_assignments`
 - `commission_tracking`
 - `commission_default`

 ## Notifications

 - `notification_events`
 - `notification_templates`
 - `notification_template_variables`
 - `notification_event_settings`
 - `notification_event_recipients`
 - `notification_template_versions`
 - `in_app_notifications`
 - `in_app_notification_reads`

 ## Email

 - `email_templates`
 - `email_providers`
 - `email_settings`
 - `email_queue`
 - `email_logs`
 - `email_queue_attempts`
 - `emaillog`
 - `emailpreference`

 ## Result Analytics

 - `result_value_analytics_observations`
 - `result_value_analytics_totals`
 - `test_analytics_snapshot`

 ## Home Collection

 - `home_collection_areas`
 - `home_collection_staff`
 - `home_collection_orders`
 - `home_collection_checklist`

 ## Accounting

 - `acc_accounts`
 - `acc_journal_entries`
 - `acc_journal_lines`
 - `acc_posting_outbox`
 - `acc_subledger_entries`
 - `acc_manual_journals`
 - `acc_manual_journal_lines`
 - `acc_periods`
 - `authority_delegations`
 - `acc_bank_accounts`
 - `acc_bank_statement_lines`
 - `finance_ledger`

 ## Existing Tables Modified By Bootstrappers

 - `roles`
 - `patients_credentials`
 - `clinicianscredentials`
 - `test_ascension`
 - `test_results`
 - `dboexpensecategory`

- Update this document whenever a bootstrapper creates, alters, or removes a table.
- This list describes application bootstrap behavior, not every table created by SQL migrations.
- `hasTable()` checks generally make creation idempotent, but they do not automatically migrate an existing table to a new column type. Existing databases may require a migration for schema changes such as converting `performed_by` to `INT UNSIGNED`.
