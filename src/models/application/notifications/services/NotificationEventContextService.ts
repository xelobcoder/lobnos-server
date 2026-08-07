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
import { EventDefinition as ProviderEventDefinition, makeDomainDefinition, readableEventName, userVariables as fallbackUserVariables } from '../context/providers/NotificationEventDefinitions';

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
     return {
          variables: userVariables(),
          requiredReferences: ['userId'],
          template: makeTemplate(eventCode, {
               subject: `${titleFromCode(eventCode)} - {{user_name}}`,
               title: titleFromCode(eventCode),
               intro: 'Provider-level specialization now owns concrete event templates.',
               details: [
                    'Event: {{event_name}}',
                    'User ID: {{user_id}}',
                    'Username: {{user_name}}',
               ],
          }),
     };
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

     private resolveProviderDefinition(eventCode: string): ProviderEventDefinition {
          const definitionProviders = [
               this.patientProvider,
               this.appointmentProvider,
               this.sampleProvider,
               this.laboratoryProvider,
               this.invoiceProvider,
               this.payrollProvider,
               this.purchaseOrderProvider,
               this.supplierProvider,
               this.inventoryProvider,
               this.doctorProvider,
          ];

          for (const provider of definitionProviders) {
               if (provider.supportsEvent?.(eventCode)) {
                    const definition = provider.getEventDefinition?.(eventCode);
                    if (definition) return definition;
               }
          }

          return makeDomainDefinition(
               eventCode,
               fallbackUserVariables(),
               ['userId'],
               readableEventName(eventCode),
               'A notification event has been generated in the laboratory platform.',
               [
                    'Event: {{event_name}}',
                    'User ID: {{user_id}}',
                    'Username: {{user_name}}',
               ],
          );
     }

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

               const definition = this.resolveProviderDefinition(event.event_code);
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
               const definition = this.resolveProviderDefinition(event.event_code);
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
               const definition = this.resolveProviderDefinition(event.event_code);
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

          const definition = this.resolveProviderDefinition(event.event_code);
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
               event.event_code.startsWith('SAMPLE_')
          ) {
               payload = {
                    ...payload,
                    ...(await this.sampleProvider.getContext(references.ascensionId as number)),
               };
          } else if (
               event.event_code.startsWith('RESULT_') ||
               event.event_code.startsWith('REPORT_') ||
               event.event_code.startsWith('IMAGING_') ||
               event.event_code === 'CRITICAL_RESULT'
          ) {
               payload = {
                    ...payload,
                    ...(await this.laboratoryProvider.getContext(references.ascensionId || references.billingId)),
               };
          } else if (
               event.event_code.startsWith('INVOICE_') ||
               event.event_code.startsWith('PAYMENT_') ||
               event.event_code.startsWith('REFUND_')
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
