# PLS Notification Expansion PRD

## Document Control
- Product: Prime Laboratory Software (PLS)
- Module: Notification Registry and Default Templates
- Date: 2026-08-07
- Status: Draft for implementation rollout

## Problem Statement
PLS currently has partial notification coverage focused on patient, appointment, sample, result, and limited billing/system events. Core business modules (payroll, procurement, supplier, and inventory) are active in production but lack a complete event lifecycle registry for controlled communication and auditability.

## Goals
1. Expand event registry to cover end-to-end business lifecycles in payroll, billing/payments, procurement, supplier, inventory, and imaging.
2. Ensure each event can be discovered through the notification catalog and auto-provisioned at bootstrap.
3. Keep notifications configurable per event/channel so tenants can avoid noisy messaging.
4. Keep event creation idempotent and safe for repeated bootstrap/migration runs.

## Non-Goals
1. Building all business-event trigger publishers in this phase.
2. Enforcing full role-based sensitive-variable masking in all send paths in this phase.
3. Building a workflow automation engine for event chaining in this phase.

## Functional Requirements
1. Event registry must include event_code, event_name, module, active status, and system flag.
2. Missing events must be auto-seeded on startup/bootstrap.
3. SQL schema seeding must create missing events idempotently.
4. Runtime catalog and default template provisioning must support newly added events.
5. Unknown/newly added events must not hard-fail due to user-only required references.

## Expanded Event Registry

### Patient
- PATIENT_CREATED
- PATIENT_UPDATED
- PATIENT_PORTAL_CREATED

### Appointment
- APPOINTMENT_CREATED
- APPOINTMENT_CONFIRMED
- APPOINTMENT_RESCHEDULED
- APPOINTMENT_CANCELLED
- APPOINTMENT_REMINDER
- APPOINTMENT_MISSED

### Sample
- SAMPLE_COLLECTED
- SAMPLE_RECEIVED
- SAMPLE_ACCEPTED
- SAMPLE_REJECTED
- SAMPLE_RECALL_REQUIRED
- SAMPLE_RECOLLECTED
- SAMPLE_PROCESSED

### Result
- RESULT_PROCESSING
- RESULT_PENDING_VERIFICATION
- RESULT_VERIFIED
- RESULT_READY
- RESULT_RELEASED
- RESULT_AMENDED
- RESULT_CORRECTED
- CRITICAL_RESULT

### Billing
- INVOICE_CREATED
- INVOICE_UPDATED
- INVOICE_SENT
- INVOICE_OVERDUE
- PAYMENT_PENDING
- PAYMENT_INITIATED
- PAYMENT_RECEIVED
- PAYMENT_CONFIRMED
- PAYMENT_FAILED
- PAYMENT_REVERSED
- PAYMENT_REFUNDED
- REFUND_REQUESTED
- REFUND_APPROVED
- REFUND_REJECTED
- REFUND_PROCESSED

### Payroll
- PAYROLL_PERIOD_CREATED
- PAYROLL_PROCESSING_STARTED
- PAYROLL_PROCESSED
- PAYROLL_APPROVED
- PAYROLL_REJECTED
- PAYROLL_FINALIZED
- PAYSLIP_GENERATED
- PAYSLIP_READY
- PAYSLIP_SENT
- SALARY_PAYMENT_PENDING
- SALARY_PAYMENT_PROCESSED
- SALARY_PAYMENT_FAILED
- PAYROLL_ADJUSTMENT_CREATED
- PAYROLL_ADJUSTMENT_APPROVED
- PAYROLL_ADJUSTMENT_REJECTED

### Procurement
- PURCHASE_ORDER_CREATED
- PURCHASE_ORDER_SUBMITTED
- PURCHASE_ORDER_APPROVED
- PURCHASE_ORDER_REJECTED
- PURCHASE_ORDER_CANCELLED
- PURCHASE_ORDER_SENT_TO_SUPPLIER
- PURCHASE_ORDER_ACKNOWLEDGED
- PURCHASE_ORDER_PARTIALLY_RECEIVED
- PURCHASE_ORDER_RECEIVED
- PURCHASE_ORDER_CLOSED
- PURCHASE_ORDER_OVERDUE

### Supplier
- SUPPLIER_CREATED
- SUPPLIER_UPDATED
- SUPPLIER_ACTIVATED
- SUPPLIER_DEACTIVATED
- SUPPLIER_PORTAL_INVITATION
- SUPPLIER_PORTAL_ACTIVATED
- SUPPLIER_DOCUMENT_EXPIRING
- SUPPLIER_DOCUMENT_EXPIRED
- SUPPLIER_PAYMENT_PENDING
- SUPPLIER_PAYMENT_PROCESSED
- SUPPLIER_PAYMENT_FAILED

### Inventory
- STOCK_RECEIPT_CREATED
- STOCK_RECEIVED
- STOCK_RECEIPT_COMPLETED
- STOCK_TRANSFER_REQUESTED
- STOCK_TRANSFER_APPROVED
- STOCK_TRANSFER_REJECTED
- STOCK_TRANSFER_COMPLETED
- STOCK_ISSUED
- STOCK_RETURNED
- STOCK_ADJUSTED
- STOCK_LOW
- STOCK_CRITICAL
- STOCK_OUT_OF_STOCK
- STOCK_RESTOCKED
- STOCK_EXPIRING
- STOCK_EXPIRED
- BATCH_EXPIRING
- BATCH_EXPIRED
- STOCKTAKE_STARTED
- STOCKTAKE_COMPLETED
- STOCK_VARIANCE_DETECTED
- STOCK_VARIANCE_APPROVED

### Imaging
- IMAGING_APPOINTMENT
- IMAGING_COMPLETED
- REPORT_READY
- REPORT_VERIFIED
- REPORT_RELEASED

### System
- USER_CREATED
- USER_ACTIVATED
- PASSWORD_RESET

## Key Variable Packs

### Payroll Processed
- employee_name
- employee_number
- payroll_period
- payroll_date
- gross_salary
- total_deductions
- net_salary
- payment_status
- branch_name
- laboratory_name

### Payslip
- employee_name
- employee_number
- payroll_period
- gross_salary
- total_deductions
- net_salary
- payslip_link
- branch_name

### Payment Received
- patient_name
- patient_number
- invoice_number
- payment_reference
- payment_method
- amount_paid
- amount_due
- balance
- payment_date
- branch_name

### Inventory Low/Out/Expiring
- item_name
- item_code
- batch_number
- current_quantity
- minimum_stock_level
- reorder_level
- required_quantity
- unit
- branch_name
- store_name
- expiry_date
- days_until_expiry

## Security and Compliance
1. Payroll salary fields are sensitive and must be recipient-scoped to employee and authorized payroll/admin roles.
2. Supplier and payment events should avoid leaking unnecessary PII in broad recipient groups.
3. Default templates should remain system-generated and editable through versioned templates.

## Channel Defaults Recommendation
1. Keep registration of events independent from channel enablement.
2. Use notification_event_settings to toggle email/sms/whatsapp/in-app per event.
3. Suggested baseline:
- STOCK_LOW: email on, in-app on, sms off.
- STOCK_CRITICAL: email on, in-app on, sms on.
- STOCK_ISSUED: email off, in-app on, sms off.
- PAYROLL_PROCESSED: email on, in-app on, sms off.
- PAYSLIP_READY: email on, in-app on, sms off.

## Technical Implementation Scope (This Delivery)
1. Expand event code registry in bootstrap and migration layers.
2. Extend SQL event seeding with idempotent insertion for new events.
3. Improve runtime fallback definition logic so non-user events do not require user references by default.
4. Keep existing event APIs and trigger APIs backward compatible.

## Out of Scope for Next Phase
1. Add module-specific trigger publishers from payroll/procurement/inventory services.
2. Add strict variable schema validation per event before send.
3. Add recipient policy matrix and sensitive-variable masking engine.
4. Add event chaining and orchestration rules.

## Rollout Plan
1. Deploy schema and bootstrap expansion.
2. Run sync-definitions endpoint per tenant.
3. Validate catalog counts and default template generation.
4. Enable channels progressively by module.

## Acceptance Criteria
1. New events appear in /api/v1/notifications/events and /catalog endpoints.
2. sync-definitions creates default template + variable rows for all new events.
3. No hard failure for new events due to missing userId when not required.
4. Existing events continue to trigger and queue/send as before.
