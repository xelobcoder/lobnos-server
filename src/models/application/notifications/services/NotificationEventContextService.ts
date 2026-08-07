import KnexConnection from '../../../../database/KnexConnections';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../repositories/NotificationTemplateVersionsRepo';
import { NotificationTemplateVariableRecord } from '../types/NotificationModels';
import { buildEnterpriseHtml, buildEnterprisePlain, TemplateParts } from './NotificationDefaultTemplateLayout';
import { AppointmentContextProvider } from '../context/providers/AppointmentContextProvider';
import { DoctorContextProvider } from '../context/providers/DoctorContextProvider';
import { InventoryContextProvider } from '../context/providers/InventoryContextProvider';
import { InvoiceContextProvider } from '../context/providers/InvoiceContextProvider';
import { LaboratoryContextProvider } from '../context/providers/LaboratoryContextProvider';
import { PatientContextProvider } from '../context/providers/PatientContextProvider';
import { PayrollContextProvider } from '../context/providers/PayrollContextProvider';
import { PurchaseOrderContextProvider } from '../context/providers/PurchaseOrderContextProvider';
import { ResultContextProvider } from '../context/providers/ResultContextProvider';
import { SampleContextProvider } from '../context/providers/SampleContextProvider';
import { SupplierContextProvider } from '../context/providers/SupplierContextProvider';
import { BranchContextProvider } from '../context/providers/BranchContextProvider';

type Scalar = string | number | boolean | null;

type EventReferenceMap = {
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

type EventVariableDefinition = {
     variable_name: string;
     display_name: string;
     data_type: string;
     description: string;
     example_value: string;
     is_required: boolean;
};

type EventTemplateDefinition = {
     template_name: string;
     subject: string;
     html_body: string;
     plain_body: string;
};

type EventDefinition = {
     variables: EventVariableDefinition[];
     template: EventTemplateDefinition;
     requiredReferences: Array<keyof EventReferenceMap>;
};

function titleFromCode(code: string): string {
     return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function stripTags(input: string): string {
     return input
          .replace(/<[^>]*>/g, '')
          .replace(/[\u0000-\u001F\u007F]/g, '')
          .trim();
}

function sanitizeScalar(value: unknown): Scalar {
     if (value === null || value === undefined) return null;
     if (typeof value === 'number') return Number.isFinite(value) ? value : null;
     if (typeof value === 'boolean') return value;
     if (value instanceof Date) return value.toISOString();
     if (typeof value === 'string') return stripTags(value);
     return stripTags(String(value));
}

function sanitizeContext(payload: Record<string, unknown>): Record<string, Scalar> {
     const sanitized: Record<string, Scalar> = {};
     for (const [key, value] of Object.entries(payload)) {
          sanitized[key] = sanitizeScalar(value);
     }
     return sanitized;
}

function commonVariables(): EventVariableDefinition[] {
     return [
          {
               variable_name: 'event_code',
               display_name: 'Event Code',
               data_type: 'string',
               description: 'Notification event code',
               example_value: 'PATIENT_CREATED',
               is_required: true,
          },
          {
               variable_name: 'event_name',
               display_name: 'Event Name',
               data_type: 'string',
               description: 'Human-friendly event name',
               example_value: 'Patient Created',
               is_required: true,
          },
          {
               variable_name: 'triggered_at',
               display_name: 'Triggered At',
               data_type: 'string',
               description: 'ISO datetime when the notification was created',
               example_value: '2026-08-07T10:30:00.000Z',
               is_required: true,
          },
     ];
}

function environmentVariables(): EventVariableDefinition[] {
     return [
          { variable_name: 'laboratory_name', display_name: 'Laboratory Name', data_type: 'string', description: 'Laboratory/company display name', example_value: 'Prime Laboratory Services', is_required: true },
          { variable_name: 'laboratory_email', display_name: 'Laboratory Email', data_type: 'string', description: 'Laboratory/company email', example_value: 'support@primelab.com', is_required: false },
          { variable_name: 'laboratory_phone', display_name: 'Laboratory Phone', data_type: 'string', description: 'Laboratory/company phone', example_value: '+233000000000', is_required: false },
          { variable_name: 'laboratory_address', display_name: 'Laboratory Address', data_type: 'string', description: 'Laboratory/company address', example_value: 'Accra, Ghana', is_required: false },
          { variable_name: 'laboratory_website', display_name: 'Laboratory Website', data_type: 'string', description: 'Laboratory/company website', example_value: 'https://example.com', is_required: false },
          { variable_name: 'branch_name', display_name: 'Branch Name', data_type: 'string', description: 'Branch name', example_value: 'Main Branch', is_required: false },
          { variable_name: 'branch_email', display_name: 'Branch Email', data_type: 'string', description: 'Branch email', example_value: 'main.branch@example.com', is_required: false },
          { variable_name: 'branch_phone', display_name: 'Branch Phone', data_type: 'string', description: 'Branch phone/contact', example_value: '+233000000000', is_required: false },
          { variable_name: 'branch_address', display_name: 'Branch Address', data_type: 'string', description: 'Branch address', example_value: '123 Main Street', is_required: false },
     ];
}

function patientVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'patient_id', display_name: 'Patient ID', data_type: 'number', description: 'Internal patient id', example_value: '1001', is_required: true },
          { variable_name: 'patient_number', display_name: 'Patient Number', data_type: 'string', description: 'Display patient number', example_value: 'PLS-0001001', is_required: false },
          { variable_name: 'patient_name', display_name: 'Patient Name', data_type: 'string', description: 'Patient full name', example_value: 'John Doe', is_required: true },
          { variable_name: 'patient_email', display_name: 'Patient Email', data_type: 'string', description: 'Patient email address', example_value: 'john@example.com', is_required: false },
          { variable_name: 'patient_phone', display_name: 'Patient Phone', data_type: 'string', description: 'Patient mobile number', example_value: '0240000000', is_required: false },
          { variable_name: 'patient_gender', display_name: 'Patient Gender', data_type: 'string', description: 'Patient gender', example_value: 'male', is_required: false },
     ];
}

function appointmentVariables(): EventVariableDefinition[] {
     return [
          ...patientVariables(),
          { variable_name: 'appointment_id', display_name: 'Appointment ID', data_type: 'number', description: 'Appointment ref id', example_value: '310', is_required: true },
          { variable_name: 'appointment_date', display_name: 'Appointment Date', data_type: 'string', description: 'Appointment date', example_value: '2026-08-07', is_required: true },
          { variable_name: 'appointment_time', display_name: 'Appointment Time', data_type: 'string', description: 'Appointment time', example_value: '09:00', is_required: true },
          { variable_name: 'appointment_purpose', display_name: 'Appointment Purpose', data_type: 'string', description: 'Appointment purpose', example_value: 'Review', is_required: false },
          { variable_name: 'practitioner_id', display_name: 'Practitioner ID', data_type: 'number', description: 'Assigned practitioner id', example_value: '20', is_required: false },
          { variable_name: 'practitioner_name', display_name: 'Practitioner Name', data_type: 'string', description: 'Assigned practitioner name', example_value: 'Dr Smith', is_required: false },
          { variable_name: 'appointment_location', display_name: 'Appointment Location', data_type: 'string', description: 'Appointment location', example_value: 'Main Branch', is_required: false },
     ];
}

function sampleVariables(): EventVariableDefinition[] {
     return [
          ...patientVariables(),
          { variable_name: 'ascension_id', display_name: 'Ascension ID', data_type: 'number', description: 'Test ascension id', example_value: '4500', is_required: true },
          { variable_name: 'sample_id', display_name: 'Sample ID', data_type: 'number', description: 'Sample status key id', example_value: '9123', is_required: false },
          { variable_name: 'test_id', display_name: 'Test ID', data_type: 'number', description: 'Test panel id', example_value: '44', is_required: true },
          { variable_name: 'test_name', display_name: 'Test Name', data_type: 'string', description: 'Test panel name', example_value: 'Full Blood Count', is_required: false },
          { variable_name: 'billing_id', display_name: 'Billing ID', data_type: 'number', description: 'Billing transaction id', example_value: '20010', is_required: true },
          { variable_name: 'collection_start_time', display_name: 'Collection Start Time', data_type: 'string', description: 'Sample collection start datetime', example_value: '2026-08-07T09:00:00.000Z', is_required: false },
          { variable_name: 'collection_end_time', display_name: 'Collection End Time', data_type: 'string', description: 'Sample collection end datetime', example_value: '2026-08-07T09:10:00.000Z', is_required: false },
          { variable_name: 'sample_rejection_reason', display_name: 'Sample Rejection Reason', data_type: 'string', description: 'Sample rejection reason', example_value: 'Hemolyzed sample', is_required: false },
          { variable_name: 'collected_by_name', display_name: 'Collected By', data_type: 'string', description: 'Collector username', example_value: 'Technician A', is_required: false },
     ];
}

function billingVariables(): EventVariableDefinition[] {
     return [
          ...patientVariables(),
          { variable_name: 'billing_id', display_name: 'Billing ID', data_type: 'number', description: 'Billing transaction id', example_value: '20010', is_required: true },
          { variable_name: 'amount_total', display_name: 'Total Amount', data_type: 'number', description: 'Total amount billed', example_value: '250', is_required: false },
          { variable_name: 'amount_paid', display_name: 'Amount Paid', data_type: 'number', description: 'Amount paid so far', example_value: '100', is_required: false },
          { variable_name: 'amount_balance', display_name: 'Amount Balance', data_type: 'number', description: 'Outstanding balance', example_value: '150', is_required: false },
          { variable_name: 'billing_status', display_name: 'Billing Status', data_type: 'string', description: 'Billing status', example_value: 'partial', is_required: false },
     ];
}

function userVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
          ...environmentVariables(),
          { variable_name: 'user_id', display_name: 'User ID', data_type: 'number', description: 'Role user id', example_value: '7', is_required: true },
          { variable_name: 'user_name', display_name: 'User Name', data_type: 'string', description: 'Username', example_value: 'jsmith', is_required: false },
          { variable_name: 'user_email', display_name: 'User Email', data_type: 'string', description: 'User email', example_value: 'jsmith@example.com', is_required: false },
     ];
}

function makeTemplate(eventCode: string, parts: TemplateParts): EventTemplateDefinition {
     return {
          template_name: `${titleFromCode(eventCode)} Default`,
          subject: parts.subject,
          html_body: buildEnterpriseHtml(parts),
          plain_body: buildEnterprisePlain(parts),
     };
}

function buildDefinition(eventCode: string): EventDefinition {
     switch (eventCode) {
          case 'PATIENT_CREATED':
               return {
                    variables: patientVariables(),
                    requiredReferences: ['patientId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Welcome to {{laboratory_name}} - {{patient_name}}',
                         title: 'Patient Registration Successful',
                         intro: 'Your patient profile has been created successfully. Please keep your patient number for future visits and result follow-up.',
                         details: [
                              'Patient Number: {{patient_number}}',
                              'Patient Name: {{patient_name}}',
                              'Patient Contact: {{patient_phone}}',
                              'Patient Email: {{patient_email}}',
                         ],
                         actionText: 'Next Step',
                         actionValue: 'Present your patient number at any branch for service support.',
                    }),
               };
          case 'PATIENT_UPDATED':
               return {
                    variables: patientVariables(),
                    requiredReferences: ['patientId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Patient Profile Updated - {{patient_name}}',
                         title: 'Patient Profile Update Notice',
                         intro: 'Changes were recorded on your patient profile. If you did not authorize this change, contact the laboratory immediately.',
                         details: [
                              'Patient Number: {{patient_number}}',
                              'Patient Name: {{patient_name}}',
                              'Contact Phone: {{patient_phone}}',
                              'Contact Email: {{patient_email}}',
                         ],
                    }),
               };
          case 'APPOINTMENT_CREATED':
               return {
                    variables: appointmentVariables(),
                    requiredReferences: ['appointmentId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Appointment Created - {{patient_name}} ({{appointment_date}})',
                         title: 'Appointment Created',
                         intro: 'An appointment has been created for this patient in the laboratory schedule.',
                         details: [
                              'Appointment ID: {{appointment_id}}',
                              'Date: {{appointment_date}}',
                              'Time: {{appointment_time}}',
                              'Practitioner: {{practitioner_name}}',
                              'Location: {{appointment_location}}',
                         ],
                    }),
               };
          case 'APPOINTMENT_CONFIRMED':
               return {
                    variables: appointmentVariables(),
                    requiredReferences: ['appointmentId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Appointment Confirmed - {{appointment_date}} {{appointment_time}}',
                         title: 'Appointment Confirmation',
                         intro: 'Your appointment has been confirmed. Please arrive on time with any required documents or prior reports.',
                         details: [
                              'Patient: {{patient_name}}',
                              'Appointment Date: {{appointment_date}}',
                              'Appointment Time: {{appointment_time}}',
                              'Practitioner: {{practitioner_name}}',
                              'Branch: {{branch_name}}',
                         ],
                         actionText: 'Preparation',
                         actionValue: 'Arrive at least 15 minutes before your scheduled time.',
                    }),
               };
          case 'APPOINTMENT_RESCHEDULED':
               return {
                    variables: appointmentVariables(),
                    requiredReferences: ['appointmentId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Appointment Rescheduled - {{patient_name}}',
                         title: 'Appointment Rescheduled',
                         intro: 'Your appointment schedule has been updated. Please review the revised date and time below.',
                         details: [
                              'Appointment ID: {{appointment_id}}',
                              'New Date: {{appointment_date}}',
                              'New Time: {{appointment_time}}',
                              'Practitioner: {{practitioner_name}}',
                              'Branch: {{branch_name}}',
                         ],
                    }),
               };
          case 'APPOINTMENT_CANCELLED':
               return {
                    variables: appointmentVariables(),
                    requiredReferences: ['appointmentId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Appointment Cancelled - {{patient_name}}',
                         title: 'Appointment Cancellation Notice',
                         intro: 'The appointment has been cancelled. Contact the branch if you need immediate assistance or a replacement slot.',
                         details: [
                              'Appointment ID: {{appointment_id}}',
                              'Date: {{appointment_date}}',
                              'Time: {{appointment_time}}',
                              'Practitioner: {{practitioner_name}}',
                         ],
                         actionText: 'Rebooking',
                         actionValue: 'Please request a new appointment through the branch front desk.',
                    }),
               };
          case 'APPOINTMENT_REMINDER':
               return {
                    variables: appointmentVariables(),
                    requiredReferences: ['appointmentId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Appointment Reminder - {{appointment_date}} {{appointment_time}}',
                         title: 'Upcoming Appointment Reminder',
                         intro: 'This is a reminder of your upcoming laboratory appointment.',
                         details: [
                              'Patient: {{patient_name}}',
                              'Date: {{appointment_date}}',
                              'Time: {{appointment_time}}',
                              'Location: {{appointment_location}}',
                              'Practitioner: {{practitioner_name}}',
                         ],
                    }),
               };
          case 'SAMPLE_COLLECTED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Sample Collected - {{patient_name}} - {{test_name}}',
                         title: 'Sample Collection Completed',
                         intro: 'Sample collection has been completed successfully and forwarded into laboratory workflow.',
                         details: [
                              'Ascension ID: {{ascension_id}}',
                              'Sample ID: {{sample_id}}',
                              'Test: {{test_name}} ({{test_id}})',
                              'Collection Start: {{collection_start_time}}',
                              'Collection End: {{collection_end_time}}',
                         ],
                    }),
               };
          case 'SAMPLE_RECEIVED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Sample Received in Lab - {{patient_name}}',
                         title: 'Sample Received',
                         intro: 'A collected sample has been received and booked into the processing queue.',
                         details: [
                              'Ascension ID: {{ascension_id}}',
                              'Sample ID: {{sample_id}}',
                              'Test Name: {{test_name}}',
                              'Collected By: {{collected_by_name}}',
                         ],
                    }),
               };
          case 'SAMPLE_REJECTED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Sample Rejected - Action Required - {{patient_name}}',
                         title: 'Sample Rejection Notice',
                         intro: 'The submitted sample did not meet processing quality criteria and has been rejected.',
                         details: [
                              'Sample ID: {{sample_id}}',
                              'Ascension ID: {{ascension_id}}',
                              'Test Name: {{test_name}}',
                              'Rejection Reason: {{sample_rejection_reason}}',
                         ],
                         actionText: 'Required Action',
                         actionValue: 'Please arrange recollection through the branch immediately.',
                    }),
               };
          case 'SAMPLE_RECALL_REQUIRED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Sample Recall Required - {{patient_name}}',
                         title: 'Sample Recall Required',
                         intro: 'A recall has been raised for this sample. Follow-up action is required to avoid delay in result release.',
                         details: [
                              'Sample ID: {{sample_id}}',
                              'Ascension ID: {{ascension_id}}',
                              'Investigation: {{test_name}}',
                              'Reason: {{sample_rejection_reason}}',
                         ],
                         actionText: 'Required Action',
                         actionValue: 'Contact patient and schedule urgent recollection.',
                    }),
               };
          case 'SAMPLE_RECOLLECTED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Sample Recollected - {{patient_name}}',
                         title: 'Sample Recollection Completed',
                         intro: 'The replacement sample has been recollected and re-entered into laboratory workflow.',
                         details: [
                              'Sample ID: {{sample_id}}',
                              'Ascension ID: {{ascension_id}}',
                              'Test Name: {{test_name}}',
                              'Collection Time: {{collection_end_time}}',
                         ],
                    }),
               };
          case 'SAMPLE_PROCESSED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Sample Processed - {{patient_name}} - {{test_name}}',
                         title: 'Sample Processing Update',
                         intro: 'Sample processing for the requested investigation has been completed.',
                         details: [
                              'Ascension ID: {{ascension_id}}',
                              'Test ID: {{test_id}}',
                              'Test Name: {{test_name}}',
                              'Billing ID: {{billing_id}}',
                         ],
                    }),
               };
          case 'RESULT_VERIFIED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Result Verified - {{patient_name}} - {{test_name}}',
                         title: 'Result Verification Completed',
                         intro: 'Laboratory review and verification of this result has been completed by authorized personnel.',
                         details: [
                              'Patient Number: {{patient_number}}',
                              'Test Name: {{test_name}}',
                              'Ascension ID: {{ascension_id}}',
                              'Billing ID: {{billing_id}}',
                         ],
                    }),
               };
          case 'RESULT_READY':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Result Ready - {{patient_name}} - {{test_name}}',
                         title: 'Result Ready for Release',
                         intro: 'The requested investigation result is ready for release according to laboratory policy.',
                         details: [
                              'Patient Number: {{patient_number}}',
                              'Test Name: {{test_name}}',
                              'Ascension ID: {{ascension_id}}',
                              'Billing ID: {{billing_id}}',
                         ],
                    }),
               };
          case 'RESULT_RELEASED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Result Released - {{patient_name}}',
                         title: 'Result Release Confirmation',
                         intro: 'This result has been officially released and is now available to authorized recipients.',
                         details: [
                              'Patient Name: {{patient_name}}',
                              'Test Name: {{test_name}}',
                              'Ascension ID: {{ascension_id}}',
                              'Released Event Time: {{triggered_at}}',
                         ],
                    }),
               };
          case 'RESULT_AMENDED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Result Amended - {{patient_name}} - {{test_name}}',
                         title: 'Result Amendment Notice',
                         intro: 'A previously released result has been amended. Please review the latest validated version.',
                         details: [
                              'Patient Number: {{patient_number}}',
                              'Test Name: {{test_name}}',
                              'Ascension ID: {{ascension_id}}',
                              'Billing ID: {{billing_id}}',
                         ],
                         actionText: 'Attention',
                         actionValue: 'Use only the latest released report for clinical decisions.',
                    }),
               };
          case 'RESULT_CORRECTED':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Result Corrected - {{patient_name}} - {{test_name}}',
                         title: 'Result Correction Notice',
                         intro: 'A correction has been applied to the result record. Please discard prior copies where applicable.',
                         details: [
                              'Patient Number: {{patient_number}}',
                              'Test Name: {{test_name}}',
                              'Ascension ID: {{ascension_id}}',
                              'Billing ID: {{billing_id}}',
                         ],
                         actionText: 'Compliance Note',
                         actionValue: 'Ensure corrected report is communicated to all relevant recipients.',
                    }),
               };
          case 'CRITICAL_RESULT':
               return {
                    variables: sampleVariables(),
                    requiredReferences: ['ascensionId'],
                    template: makeTemplate(eventCode, {
                         subject: 'CRITICAL RESULT ALERT - {{patient_name}} - {{test_name}}',
                         title: 'Critical Result Alert',
                         intro: 'A critical laboratory result event has been raised and requires immediate authorized action.',
                         details: [
                              'Patient Name: {{patient_name}}',
                              'Patient Number: {{patient_number}}',
                              'Test Name: {{test_name}}',
                              'Ascension ID: {{ascension_id}}',
                         ],
                         actionText: 'Urgent Action',
                         actionValue: 'Escalate to responsible clinician immediately according to critical value policy.',
                    }),
               };
          case 'INVOICE_CREATED':
               return {
                    variables: billingVariables(),
                    requiredReferences: ['billingId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Invoice Created - {{billing_id}} - {{patient_name}}',
                         title: 'Invoice Creation Notice',
                         intro: 'A new billing invoice has been created for this patient transaction.',
                         details: [
                              'Invoice/Billing ID: {{billing_id}}',
                              'Patient: {{patient_name}}',
                              'Total Amount: {{amount_total}}',
                              'Status: {{billing_status}}',
                         ],
                    }),
               };
          case 'INVOICE_SENT':
               return {
                    variables: billingVariables(),
                    requiredReferences: ['billingId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Invoice Sent - {{billing_id}}',
                         title: 'Invoice Dispatch Confirmation',
                         intro: 'The invoice has been sent to the configured recipient channels.',
                         details: [
                              'Invoice/Billing ID: {{billing_id}}',
                              'Patient: {{patient_name}}',
                              'Amount: {{amount_total}}',
                              'Outstanding Balance: {{amount_balance}}',
                         ],
                    }),
               };
          case 'PAYMENT_RECEIVED':
               return {
                    variables: billingVariables(),
                    requiredReferences: ['billingId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Payment Received - {{billing_id}}',
                         title: 'Payment Receipt Notice',
                         intro: 'Payment has been posted successfully against this billing transaction.',
                         details: [
                              'Billing ID: {{billing_id}}',
                              'Patient: {{patient_name}}',
                              'Amount Paid: {{amount_paid}}',
                              'Remaining Balance: {{amount_balance}}',
                         ],
                    }),
               };
          case 'PAYMENT_FAILED':
               return {
                    variables: billingVariables(),
                    requiredReferences: ['billingId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Payment Failed - {{billing_id}}',
                         title: 'Payment Failure Alert',
                         intro: 'A payment attempt failed for this billing record. Follow-up is required to complete settlement.',
                         details: [
                              'Billing ID: {{billing_id}}',
                              'Patient: {{patient_name}}',
                              'Total Amount: {{amount_total}}',
                              'Outstanding Balance: {{amount_balance}}',
                         ],
                         actionText: 'Next Step',
                         actionValue: 'Contact patient/organization to complete payment.',
                    }),
               };
          case 'REPORT_READY':
               return {
                    variables: billingVariables(),
                    requiredReferences: ['billingId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Report Ready - {{patient_name}}',
                         title: 'Report Availability Notice',
                         intro: 'A laboratory report associated with this transaction is now ready for authorized collection.',
                         details: [
                              'Patient: {{patient_name}}',
                              'Patient Number: {{patient_number}}',
                              'Billing ID: {{billing_id}}',
                              'Status: {{billing_status}}',
                         ],
                    }),
               };
          case 'USER_CREATED':
               return {
                    variables: userVariables(),
                    requiredReferences: ['userId'],
                    template: makeTemplate(eventCode, {
                         subject: 'User Account Created - {{user_name}}',
                         title: 'User Account Provisioned',
                         intro: 'A new user account has been provisioned in the laboratory platform.',
                         details: [
                              'User ID: {{user_id}}',
                              'Username: {{user_name}}',
                              'Email: {{user_email}}',
                         ],
                    }),
               };
          case 'USER_ACTIVATED':
               return {
                    variables: userVariables(),
                    requiredReferences: ['userId'],
                    template: makeTemplate(eventCode, {
                         subject: 'User Account Activated - {{user_name}}',
                         title: 'User Activation Notice',
                         intro: 'The user account has been activated and may now access permitted modules.',
                         details: [
                              'User ID: {{user_id}}',
                              'Username: {{user_name}}',
                              'Email: {{user_email}}',
                         ],
                    }),
               };
          case 'PASSWORD_RESET':
               return {
                    variables: userVariables(),
                    requiredReferences: ['userId'],
                    template: makeTemplate(eventCode, {
                         subject: 'Password Reset Notice - {{user_name}}',
                         title: 'Password Reset Event',
                         intro: 'A password reset event has been recorded for this account. If not initiated by you, report immediately.',
                         details: [
                              'User ID: {{user_id}}',
                              'Username: {{user_name}}',
                              'Email: {{user_email}}',
                         ],
                         actionText: 'Security Advice',
                         actionValue: 'Review account activity and rotate credentials if needed.',
                    }),
               };
          default:
               return {
                    variables: userVariables(),
                    requiredReferences: ['userId'],
                    template: makeTemplate(eventCode, {
                         subject: `${titleFromCode(eventCode)} - {{user_name}}`,
                         title: titleFromCode(eventCode),
                         intro: 'A notification event has been generated in the laboratory platform.',
                         details: [
                              'Event: {{event_name}}',
                              'User ID: {{user_id}}',
                              'Username: {{user_name}}',
                         ],
                    }),
               };
     }
}

export class NotificationEventContextService {
     private connection;
     private patientProvider: PatientContextProvider;
     private appointmentProvider: AppointmentContextProvider;
     private sampleProvider: SampleContextProvider;
     private resultProvider: ResultContextProvider;
     private invoiceProvider: InvoiceContextProvider;
     private payrollProvider: PayrollContextProvider;
     private purchaseOrderProvider: PurchaseOrderContextProvider;
     private supplierProvider: SupplierContextProvider;
     private inventoryProvider: InventoryContextProvider;
     private doctorProvider: DoctorContextProvider;
     private laboratoryProvider: LaboratoryContextProvider;
     private branchProvider: BranchContextProvider;

     constructor(
          private eventsRepo: NotificationEventsRepo,
          private templatesRepo: NotificationTemplatesRepo,
          private variablesRepo: NotificationTemplateVariablesRepo,
          private versionsRepo: NotificationTemplateVersionsRepo,
          private tenantId: number,
     ) {
          this.connection = KnexConnection(tenantId);
          this.patientProvider = new PatientContextProvider(tenantId);
          this.appointmentProvider = new AppointmentContextProvider(tenantId);
          this.sampleProvider = new SampleContextProvider(tenantId);
          this.resultProvider = new ResultContextProvider(tenantId);
          this.invoiceProvider = new InvoiceContextProvider(tenantId);
          this.payrollProvider = new PayrollContextProvider(tenantId);
          this.purchaseOrderProvider = new PurchaseOrderContextProvider(tenantId);
          this.supplierProvider = new SupplierContextProvider(tenantId);
          this.inventoryProvider = new InventoryContextProvider(tenantId);
          this.doctorProvider = new DoctorContextProvider(tenantId);
          this.laboratoryProvider = new LaboratoryContextProvider(tenantId);
          this.branchProvider = new BranchContextProvider(tenantId);
     }

     async getEventCatalog(eventCode?: string) {
          if (eventCode) {
               const event = await this.eventsRepo.findByCode(eventCode);
               if (!event) throw new Error('Notification event not found');

               const definition = buildDefinition(event.event_code);
               const template = await this.templatesRepo.findSystemDefaultForEvent(event.id as number);

               return {
                    event,
                    variables: definition.variables,
                    template: template || definition.template,
                    requiredReferences: definition.requiredReferences,
               };
          }

          const events = await this.eventsRepo.findAll();
          return Promise.all(events.map(async (event) => {
               const definition = buildDefinition(event.event_code);
               const template = await this.templatesRepo.findSystemDefaultForEvent(event.id as number);
               return {
                    event,
                    variables: definition.variables,
                    template: template || definition.template,
                    requiredReferences: definition.requiredReferences,
               };
          }));
     }

     async ensureSystemDefinitions() {
          const events = await this.eventsRepo.findAll();
          const results: Array<{ eventCode: string; variablesInserted: number; templateCreated: boolean; templateBackfilled: boolean }> = [];

          for (const event of events) {
               const definition = buildDefinition(event.event_code);
               const existingVariables = await this.variablesRepo.findByEventId(event.id as number);
               const existingVariableNames = new Set(existingVariables.map((row) => row.variable_name));

               let variablesInserted = 0;
               for (const variable of definition.variables) {
                    if (existingVariableNames.has(variable.variable_name)) continue;

                    await this.variablesRepo.create({
                         event_id: event.id as number,
                         ...variable,
                    } as NotificationTemplateVariableRecord);

                    variablesInserted += 1;
               }

               let templateCreated = false;
               let templateBackfilled = false;
               const existingTemplate = await this.templatesRepo.findSystemDefaultForEvent(event.id as number);
               if (!existingTemplate) {
                    const templateId = await this.templatesRepo.create({
                         event_id: event.id as number,
                         template_name: definition.template.template_name,
                         subject: definition.template.subject,
                         html_body: definition.template.html_body,
                         plain_body: definition.template.plain_body,
                         is_system: true,
                         is_default: true,
                         is_active: true,
                         created_by: null,
                         updated_by: null,
                    });

                    await this.versionsRepo.create({
                         template_id: templateId,
                         version: 1,
                         subject: definition.template.subject,
                         html_body: definition.template.html_body,
                         plain_body: definition.template.plain_body,
                         changed_by: null,
                    });

                    templateCreated = true;
               } else {
                    const shouldBackfill = !existingTemplate.subject
                         || !existingTemplate.html_body
                         || !existingTemplate.plain_body;

                    const shouldStandardize = !!existingTemplate.is_system
                         && !!existingTemplate.is_default
                         && (
                              existingTemplate.subject !== definition.template.subject
                              || existingTemplate.html_body !== definition.template.html_body
                              || existingTemplate.plain_body !== definition.template.plain_body
                         );

                    if (shouldBackfill || shouldStandardize) {
                         const updatedSubject = shouldStandardize
                              ? definition.template.subject
                              : existingTemplate.subject || definition.template.subject;
                         const updatedHtml = shouldStandardize
                              ? definition.template.html_body
                              : existingTemplate.html_body || definition.template.html_body;
                         const updatedPlain = shouldStandardize
                              ? definition.template.plain_body
                              : existingTemplate.plain_body || definition.template.plain_body;

                         await this.templatesRepo.update(existingTemplate.id as number, {
                              template_name: existingTemplate.template_name || definition.template.template_name,
                              subject: updatedSubject,
                              html_body: updatedHtml,
                              plain_body: updatedPlain,
                              updated_by: null,
                         });

                         const version = (await this.versionsRepo.findLatestVersion(existingTemplate.id as number)) + 1;
                         await this.versionsRepo.create({
                              template_id: existingTemplate.id as number,
                              version,
                              subject: updatedSubject,
                              html_body: updatedHtml,
                              plain_body: updatedPlain,
                              changed_by: null,
                         });

                         templateBackfilled = true;
                    }
               }

               results.push({
                    eventCode: event.event_code,
                    variablesInserted,
                    templateCreated,
                    templateBackfilled,
               });
          }

          return results;
     }

     async resolveEventContext(
          eventCode: string,
          references: EventReferenceMap,
          extraContext: Record<string, unknown> = {},
     ): Promise<Record<string, Scalar>> {
          const event = await this.eventsRepo.findByCode(eventCode);
          if (!event) throw new Error('Notification event not found');

          const definition = buildDefinition(event.event_code);
          for (const requiredRef of definition.requiredReferences) {
               if (!references[requiredRef]) {
                    throw new Error(`Missing required reference: ${requiredRef}`);
               }
          }

          let payload: Record<string, unknown> = {
               event_code: event.event_code,
               event_name: event.event_name,
               triggered_at: new Date().toISOString(),
          };

          if (event.event_code.startsWith('PATIENT_')) {
               payload = {
                    ...payload,
                    ...(await this.patientProvider.getContext(references.patientId as number)),
               };
          } else if (event.event_code.startsWith('APPOINTMENT_')) {
               payload = {
                    ...payload,
                    ...(await this.appointmentProvider.getContext(references.appointmentId as number)),
               };
          } else if (
               event.event_code.startsWith('SAMPLE_') ||
               event.event_code.startsWith('RESULT_') ||
               event.event_code === 'CRITICAL_RESULT'
          ) {
               payload = {
                    ...payload,
                    ...(await this.resultProvider.getContext(references.ascensionId as number)),
               };
          } else if (
               event.event_code.startsWith('INVOICE_') ||
               event.event_code.startsWith('PAYMENT_') ||
               event.event_code === 'REPORT_READY'
          ) {
               payload = {
                    ...payload,
                    ...(await this.invoiceProvider.getContext(references.billingId as number)),
               };
          } else if (event.event_code.startsWith('PAYROLL_') || event.event_code.startsWith('SALARY_') || event.event_code.startsWith('PAYSLIP_')) {
               payload = {
                    ...payload,
                    ...(await this.payrollProvider.getContext(references.payrollId as number)),
               };
          } else if (event.event_code.startsWith('PURCHASE_ORDER_')) {
               payload = {
                    ...payload,
                    ...(await this.purchaseOrderProvider.getContext(references.purchaseOrderId as number)),
               };
          } else if (event.event_code.startsWith('SUPPLIER_')) {
               payload = {
                    ...payload,
                    ...(await this.supplierProvider.getContext(references.supplierId as number)),
               };
          } else if (event.event_code.startsWith('STOCK_') || event.event_code.startsWith('BATCH_')) {
               payload = {
                    ...payload,
                    ...(await this.inventoryProvider.getContext(references.inventoryId as number)),
               };
          } else {
               payload = {
                    ...payload,
                    ...(await this.doctorProvider.getContext((references.userId || references.doctorId) as number)),
               };
          }

          const branchIdRaw = payload.branch_id;
          const branchId = typeof branchIdRaw === 'number' ? branchIdRaw : Number(branchIdRaw || 0);
          const [labContext, branchContext] = await Promise.all([
               this.laboratoryProvider.getContext(),
               this.branchProvider.getContext(branchId > 0 ? branchId : undefined),
          ]);

          return sanitizeContext({ ...payload, ...labContext, ...branchContext, ...extraContext });
     }
}
