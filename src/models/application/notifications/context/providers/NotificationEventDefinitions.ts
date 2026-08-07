import { buildEnterpriseHtml, buildEnterprisePlain, TemplateParts } from '../../services/NotificationDefaultTemplateLayout';

export type EventReferenceMap = {
     patientId?: number | string;
     appointmentId?: number | string;
     ascensionId?: number | string;
     billingId?: number | string;
     userId?: number | string;
     payrollId?: number | string;
     purchaseOrderId?: number | string;
     supplierId?: number | string;
     inventoryId?: number | string;
     doctorId?: number | string;
};

export type EventVariableDefinition = {
     variable_name: string;
     display_name: string;
     data_type: string;
     description: string;
     example_value: string;
     is_required: boolean;
};

export type EventTemplateDefinition = {
     template_name: string;
     subject: string;
     html_body: string;
     plain_body: string;
};

export type EventDefinition = {
     variables: EventVariableDefinition[];
     template: EventTemplateDefinition;
     requiredReferences: Array<keyof EventReferenceMap>;
};

function titleFromCode(code: string): string {
     return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function makeTemplate(eventCode: string, parts: TemplateParts): EventTemplateDefinition {
     return {
          template_name: `${titleFromCode(eventCode)} Default`,
          subject: parts.subject,
          html_body: buildEnterpriseHtml(parts),
          plain_body: buildEnterprisePlain(parts),
     };
}

function commonVariables(): EventVariableDefinition[] {
     return [
          { variable_name: 'event_code', display_name: 'Event Code', data_type: 'string', description: 'Notification event code', example_value: 'PATIENT_CREATED', is_required: true },
          { variable_name: 'event_name', display_name: 'Event Name', data_type: 'string', description: 'Human-friendly event name', example_value: 'Patient Created', is_required: true },
          { variable_name: 'triggered_at', display_name: 'Triggered At', data_type: 'string', description: 'ISO datetime when event was triggered', example_value: '2026-08-07T10:30:00.000Z', is_required: true },
     ];
}

function environmentVariables(): EventVariableDefinition[] {
     return [
          { variable_name: 'laboratory_name', display_name: 'Laboratory Name', data_type: 'string', description: 'Laboratory/company name', example_value: 'Prime Laboratory Services', is_required: false },
          { variable_name: 'laboratory_email', display_name: 'Laboratory Email', data_type: 'string', description: 'Laboratory email', example_value: 'support@primelab.com', is_required: false },
          { variable_name: 'laboratory_phone', display_name: 'Laboratory Phone', data_type: 'string', description: 'Laboratory phone', example_value: '+233000000000', is_required: false },
          { variable_name: 'laboratory_address', display_name: 'Laboratory Address', data_type: 'string', description: 'Laboratory address', example_value: 'Accra', is_required: false },
          { variable_name: 'laboratory_website', display_name: 'Laboratory Website', data_type: 'string', description: 'Laboratory website', example_value: 'https://example.com', is_required: false },
          { variable_name: 'branch_name', display_name: 'Branch Name', data_type: 'string', description: 'Branch name', example_value: 'Main Branch', is_required: false },
          { variable_name: 'branch_email', display_name: 'Branch Email', data_type: 'string', description: 'Branch email', example_value: 'main.branch@example.com', is_required: false },
          { variable_name: 'branch_phone', display_name: 'Branch Phone', data_type: 'string', description: 'Branch phone', example_value: '+233000000000', is_required: false },
          { variable_name: 'branch_address', display_name: 'Branch Address', data_type: 'string', description: 'Branch address', example_value: '123 Main St', is_required: false },
     ];
}

export function patientVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'patient_id', display_name: 'Patient ID', data_type: 'number', description: 'Internal patient ID', example_value: '1001', is_required: false },
          { variable_name: 'patient_number', display_name: 'Patient Number', data_type: 'string', description: 'Patient number', example_value: 'PLS-0001001', is_required: false },
          { variable_name: 'patient_name', display_name: 'Patient Name', data_type: 'string', description: 'Patient full name', example_value: 'John Doe', is_required: false },
          { variable_name: 'patient_email', display_name: 'Patient Email', data_type: 'string', description: 'Patient email', example_value: 'john@example.com', is_required: false },
          { variable_name: 'patient_phone', display_name: 'Patient Phone', data_type: 'string', description: 'Patient phone', example_value: '0240000000', is_required: false },
          { variable_name: 'patient_gender', display_name: 'Patient Gender', data_type: 'string', description: 'Patient gender', example_value: 'male', is_required: false },
     ];
}

export function appointmentVariables(): EventVariableDefinition[] {
     return [
          ...patientVariables(),
          { variable_name: 'appointment_id', display_name: 'Appointment ID', data_type: 'number', description: 'Appointment ID', example_value: '310', is_required: false },
          { variable_name: 'appointment_date', display_name: 'Appointment Date', data_type: 'string', description: 'Appointment date', example_value: '2026-08-07', is_required: false },
          { variable_name: 'appointment_time', display_name: 'Appointment Time', data_type: 'string', description: 'Appointment time', example_value: '09:00', is_required: false },
          { variable_name: 'appointment_purpose', display_name: 'Appointment Purpose', data_type: 'string', description: 'Purpose', example_value: 'Review', is_required: false },
          { variable_name: 'practitioner_name', display_name: 'Practitioner Name', data_type: 'string', description: 'Practitioner', example_value: 'Dr Smith', is_required: false },
          { variable_name: 'appointment_location', display_name: 'Appointment Location', data_type: 'string', description: 'Location', example_value: 'Main Branch', is_required: false },
     ];
}

export function sampleVariables(): EventVariableDefinition[] {
     return [
          ...patientVariables(),
          { variable_name: 'ascension_id', display_name: 'Ascension ID', data_type: 'number', description: 'Ascension ID', example_value: '4500', is_required: false },
          { variable_name: 'sample_id', display_name: 'Sample ID', data_type: 'number', description: 'Sample ID', example_value: '9123', is_required: false },
          { variable_name: 'test_id', display_name: 'Test ID', data_type: 'number', description: 'Test ID', example_value: '44', is_required: false },
          { variable_name: 'test_name', display_name: 'Test Name', data_type: 'string', description: 'Test name', example_value: 'Full Blood Count', is_required: false },
          { variable_name: 'billing_id', display_name: 'Billing ID', data_type: 'number', description: 'Billing ID', example_value: '20010', is_required: false },
          { variable_name: 'collection_start_time', display_name: 'Collection Start Time', data_type: 'string', description: 'Collection start', example_value: '2026-08-07T09:00:00.000Z', is_required: false },
          { variable_name: 'collection_end_time', display_name: 'Collection End Time', data_type: 'string', description: 'Collection end', example_value: '2026-08-07T09:10:00.000Z', is_required: false },
          { variable_name: 'sample_rejection_reason', display_name: 'Sample Rejection Reason', data_type: 'string', description: 'Rejection reason', example_value: 'Hemolyzed sample', is_required: false },
          { variable_name: 'collected_by_name', display_name: 'Collected By', data_type: 'string', description: 'Collector name', example_value: 'Technician A', is_required: false },
     ];
}

export function billingVariables(): EventVariableDefinition[] {
     return [
          ...patientVariables(),
          { variable_name: 'billing_id', display_name: 'Billing ID', data_type: 'number', description: 'Billing ID', example_value: '20010', is_required: false },
          { variable_name: 'amount_total', display_name: 'Total Amount', data_type: 'number', description: 'Total amount', example_value: '250', is_required: false },
          { variable_name: 'amount_paid', display_name: 'Amount Paid', data_type: 'number', description: 'Amount paid', example_value: '100', is_required: false },
          { variable_name: 'amount_balance', display_name: 'Amount Balance', data_type: 'number', description: 'Balance', example_value: '150', is_required: false },
          { variable_name: 'billing_status', display_name: 'Billing Status', data_type: 'string', description: 'Billing status', example_value: 'partial', is_required: false },
     ];
}

export function userVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'user_id', display_name: 'User ID', data_type: 'number', description: 'User ID', example_value: '7', is_required: false },
          { variable_name: 'user_name', display_name: 'User Name', data_type: 'string', description: 'Username', example_value: 'jsmith', is_required: false },
          { variable_name: 'user_email', display_name: 'User Email', data_type: 'string', description: 'User email', example_value: 'jsmith@example.com', is_required: false },
     ];
}

export function payrollVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'payroll_transaction_id', display_name: 'Payroll Transaction ID', data_type: 'number', description: 'Payroll transaction id', example_value: '10', is_required: false },
          { variable_name: 'payroll_period', display_name: 'Payroll Period', data_type: 'string', description: 'Payroll period', example_value: 'August 2026', is_required: false },
          { variable_name: 'employee_id', display_name: 'Employee ID', data_type: 'number', description: 'Employee ID', example_value: '23', is_required: false },
          { variable_name: 'employee_name', display_name: 'Employee Name', data_type: 'string', description: 'Employee name', example_value: 'Jane Doe', is_required: false },
          { variable_name: 'gross_salary', display_name: 'Gross Salary', data_type: 'number', description: 'Gross salary', example_value: '1200', is_required: false },
          { variable_name: 'total_deductions', display_name: 'Total Deductions', data_type: 'number', description: 'Deductions', example_value: '200', is_required: false },
          { variable_name: 'net_salary', display_name: 'Net Salary', data_type: 'number', description: 'Net salary', example_value: '1000', is_required: false },
          { variable_name: 'payroll_status', display_name: 'Payroll Status', data_type: 'string', description: 'Status', example_value: 'approved', is_required: false },
     ];
}

export function purchaseOrderVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'purchase_order_id', display_name: 'Purchase Order ID', data_type: 'string', description: 'PO ID', example_value: 'PO-1723', is_required: false },
          { variable_name: 'order_number', display_name: 'Order Number', data_type: 'string', description: 'Order number', example_value: 'ORD-20260807-0001', is_required: false },
          { variable_name: 'purchase_order_status', display_name: 'Purchase Order Status', data_type: 'string', description: 'PO status', example_value: 'approved', is_required: false },
          { variable_name: 'purchase_order_total', display_name: 'Purchase Order Total', data_type: 'number', description: 'PO total', example_value: '4500', is_required: false },
          { variable_name: 'order_date', display_name: 'Order Date', data_type: 'string', description: 'Order date', example_value: '2026-08-07', is_required: false },
          { variable_name: 'expected_delivery_date', display_name: 'Expected Delivery Date', data_type: 'string', description: 'Expected delivery date', example_value: '2026-08-10', is_required: false },
          { variable_name: 'supplier_id', display_name: 'Supplier ID', data_type: 'string', description: 'Supplier ID', example_value: 'SUP-100', is_required: false },
          { variable_name: 'supplier_name', display_name: 'Supplier Name', data_type: 'string', description: 'Supplier name', example_value: 'ABC Meds', is_required: false },
          { variable_name: 'supplier_email', display_name: 'Supplier Email', data_type: 'string', description: 'Supplier email', example_value: 'supplier@example.com', is_required: false },
          { variable_name: 'purchase_order_items_text', display_name: 'Purchase Order Items Text', data_type: 'string', description: 'Plain-text itemized order summary', example_value: '1. Gloves | Qty Ordered: 10 | Unit Price: 5.00 | Line Total: 50.00', is_required: false },
          { variable_name: 'purchase_order_items_html', display_name: 'Purchase Order Items HTML', data_type: 'string', description: 'HTML rows for ordered items', example_value: '<tr><td>1</td><td>Gloves</td><td>GL-001</td><td>10</td><td>5.00</td><td>50.00</td></tr>', is_required: false },
     ];
}

export function supplierVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'supplier_id', display_name: 'Supplier ID', data_type: 'string', description: 'Supplier ID', example_value: 'SUP-100', is_required: false },
          { variable_name: 'supplier_name', display_name: 'Supplier Name', data_type: 'string', description: 'Supplier name', example_value: 'ABC Meds', is_required: false },
          { variable_name: 'supplier_contact', display_name: 'Supplier Contact', data_type: 'string', description: 'Supplier contact', example_value: 'Jane', is_required: false },
          { variable_name: 'supplier_email', display_name: 'Supplier Email', data_type: 'string', description: 'Supplier email', example_value: 's@example.com', is_required: false },
          { variable_name: 'supplier_phone', display_name: 'Supplier Phone', data_type: 'string', description: 'Supplier phone', example_value: '+233...', is_required: false },
          { variable_name: 'supplier_active', display_name: 'Supplier Active', data_type: 'boolean', description: 'Supplier state', example_value: 'true', is_required: false },
     ];
}

export function inventoryVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'inventory_item_id', display_name: 'Inventory Item ID', data_type: 'string', description: 'Item ID', example_value: 'INV-100', is_required: false },
          { variable_name: 'item_name', display_name: 'Item Name', data_type: 'string', description: 'Item name', example_value: 'Gloves', is_required: false },
          { variable_name: 'item_sku', display_name: 'Item SKU', data_type: 'string', description: 'Item SKU', example_value: 'GL-001', is_required: false },
          { variable_name: 'current_stock', display_name: 'Current Stock', data_type: 'number', description: 'Current stock', example_value: '20', is_required: false },
          { variable_name: 'min_stock', display_name: 'Minimum Stock', data_type: 'number', description: 'Minimum stock', example_value: '10', is_required: false },
          { variable_name: 'stock_status', display_name: 'Stock Status', data_type: 'string', description: 'Stock status', example_value: 'low_stock', is_required: false },
          { variable_name: 'category_name', display_name: 'Category Name', data_type: 'string', description: 'Category', example_value: 'Consumables', is_required: false },
          { variable_name: 'location_name', display_name: 'Location Name', data_type: 'string', description: 'Location', example_value: 'Main Store', is_required: false },
     ];
}

export function laboratoryVariables(): EventVariableDefinition[] {
     return [
          ...sampleVariables(),
          { variable_name: 'result_status', display_name: 'Result Status', data_type: 'string', description: 'Result lifecycle status', example_value: 'verified', is_required: false },
          { variable_name: 'report_status', display_name: 'Report Status', data_type: 'string', description: 'Report status', example_value: 'released', is_required: false },
          { variable_name: 'lifecycle_stage', display_name: 'Lifecycle Stage', data_type: 'string', description: 'Result lifecycle stage', example_value: 'result_verified', is_required: false },
     ];
}

export function makeDomainDefinition(eventCode: string, variables: EventVariableDefinition[], requiredReferences: Array<keyof EventReferenceMap>, title: string, intro: string, details: string[], actionText?: string, actionValue?: string): EventDefinition {
     return {
          variables,
          requiredReferences,
          template: makeTemplate(eventCode, {
               subject: `${title} - {{event_name}}`,
               title,
               intro,
               details,
               actionText,
               actionValue,
          }),
     };
}

export function readableEventName(eventCode: string): string {
     return titleFromCode(eventCode);
}
