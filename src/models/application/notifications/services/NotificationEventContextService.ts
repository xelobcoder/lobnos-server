import KnexConnection from '../../../../database/KnexConnections';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../repositories/NotificationTemplateVersionsRepo';
import { NotificationTemplateVariableRecord } from '../types/NotificationModels';

type Scalar = string | number | boolean | null;

type EventReferenceMap = {
     patientId?: number;
     appointmentId?: number;
     ascensionId?: number;
     billingId?: number;
     userId?: number;
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

type TemplateParts = {
     subject: string;
     title: string;
     intro: string;
     details: string[];
     actionText?: string;
     actionValue?: string;
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

function patientVariables(): EventVariableDefinition[] {
     return [
          ...commonVariables(),
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
          { variable_name: 'user_id', display_name: 'User ID', data_type: 'number', description: 'Role user id', example_value: '7', is_required: true },
          { variable_name: 'user_name', display_name: 'User Name', data_type: 'string', description: 'Username', example_value: 'jsmith', is_required: false },
          { variable_name: 'user_email', display_name: 'User Email', data_type: 'string', description: 'User email', example_value: 'jsmith@example.com', is_required: false },
     ];
}

function buildEnterpriseHtml(eventCode: string, parts: TemplateParts): string {
     const detailsHtml = parts.details
          .map((line) => `<li style="margin: 0 0 8px 0;">${line}</li>`)
          .join('');

     const actionBlock = parts.actionText && parts.actionValue
          ? `
               <tr>
                    <td style="padding: 0 28px 18px 28px;">
                         <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0;">
                              <tr>
                                   <td style="background: #eaf2ff; border: 1px solid #c9ddff; border-radius: 6px; padding: 14px 16px;">
                                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
                                             <strong>${parts.actionText}:</strong> ${parts.actionValue}
                                        </p>
                                   </td>
                              </tr>
                         </table>
                    </td>
               </tr>`
          : '';

     return `
<!DOCTYPE html>
<html lang="en">
<head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
     <title>${parts.title}</title>
     <style>
          body { margin: 0; padding: 0; background: #edf2f7; }
          table { border-collapse: collapse; }
          img { border: 0; outline: none; text-decoration: none; display: block; }
          @media only screen and (max-width: 640px) {
               .pls-shell { width: 100% !important; }
               .pls-pad { padding-left: 16px !important; padding-right: 16px !important; }
               .pls-title { font-size: 22px !important; }
          }
     </style>
</head>
<body>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background: #edf2f7; padding: 20px 8px;">
          <tr>
               <td align="center">
                    <table role="presentation" class="pls-shell" width="760" cellspacing="0" cellpadding="0" style="width: 760px; max-width: 760px; background: #ffffff; border: 1px solid #d9e2ec; border-radius: 10px; overflow: hidden;">
                         <tr>
                              <td>
                                   <header>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #0b3a6e;">
                                             <tr>
                                                  <td class="pls-pad" style="padding: 22px 28px; color: #ffffff;">
                                                       <p style="margin: 0 0 6px 0; font-size: 12px; letter-spacing: 0.8px; font-weight: 600; opacity: 0.95;">PRIME LABORATORY SYSTEM</p>
                                                       <h1 class="pls-title" style="margin: 0; font-size: 26px; line-height: 1.3; font-weight: 700;">${parts.title}</h1>
                                                  </td>
                                             </tr>
                                        </table>
                                   </header>
                              </td>
                         </tr>

                         <tr>
                              <td>
                                   <main>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                             <tr>
                                                  <td class="pls-pad" style="padding: 26px 28px 12px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #111827;">
                                                       <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.65;">Dear {{patient_name}},</p>
                                                       <p style="margin: 0; font-size: 14px; line-height: 1.75; color: #374151;">${parts.intro}</p>
                                                  </td>
                                             </tr>

                                             <tr>
                                                  <td class="pls-pad" style="padding: 10px 28px 10px 28px;">
                                                       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
                                                            <tr>
                                                                 <td style="padding: 16px 18px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #111827;">
                                                                      <h2 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</h2>
                                                                      <ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.65; color: #111827;">
                                                                           ${detailsHtml}
                                                                      </ul>
                                                                 </td>
                                                            </tr>
                                                       </table>
                                                  </td>
                                             </tr>

                                             ${actionBlock}

                                             <tr>
                                                  <td class="pls-pad" style="padding: 10px 28px 18px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                                       <p style="margin: 0; font-size: 12px; line-height: 1.7; color: #6b7280;">
                                                            Event Code: <strong>{{event_code}}</strong><br />
                                                            Triggered At: {{triggered_at}}
                                                       </p>
                                                  </td>
                                             </tr>
                                        </table>
                                   </main>
                              </td>
                         </tr>

                         <tr>
                              <td>
                                   <footer>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f9fafb; border-top: 1px solid #e5e7eb;">
                                             <tr>
                                                  <td class="pls-pad" style="padding: 16px 28px 20px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #4b5563;">
                                                       <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.65;">This is a system-generated communication from Prime Laboratory System.</p>
                                                       <p style="margin: 0; font-size: 12px; line-height: 1.65;">Please do not share this message with unauthorized persons. For support, contact your laboratory administration.</p>
                                                  </td>
                                             </tr>
                                        </table>
                                   </footer>
                              </td>
                         </tr>
                    </table>
               </td>
          </tr>
     </table>
</body>
</html>`.trim();
}

function buildEnterprisePlain(eventCode: string, parts: TemplateParts): string {
     const detailLines = parts.details.map((line) => `- ${line}`).join('\n');
     const actionLine = parts.actionText && parts.actionValue
          ? `\n${parts.actionText}: ${parts.actionValue}`
          : '';

     return [
          `LABORATORY NOTIFICATION: ${parts.title}`,
          '',
          'Dear {{patient_name}},',
          parts.intro,
          '',
          'Details:',
          detailLines,
          actionLine,
          '',
          'Event Code: {{event_code}}',
          'Event Time: {{triggered_at}}',
          '',
          'This is a system-generated laboratory message.',
     ].join('\n');
}

function makeTemplate(eventCode: string, parts: TemplateParts): EventTemplateDefinition {
     return {
          template_name: `${titleFromCode(eventCode)} Default`,
          subject: parts.subject,
          html_body: buildEnterpriseHtml(eventCode, parts),
          plain_body: buildEnterprisePlain(eventCode, parts),
     };
}

function buildDefinition(eventCode: string): EventDefinition {
     if (eventCode.startsWith('PATIENT_')) {
          return {
               variables: patientVariables(),
               requiredReferences: ['patientId'],
               template: makeTemplate(eventCode, {
                    subject: 'Patient Update - {{patient_name}} ({{patient_number}})',
                    title: 'Patient Profile Update',
                    intro: 'A patient profile event has been processed successfully in the laboratory system.',
                    details: [
                         'Patient ID: {{patient_id}}',
                         'Patient Number: {{patient_number}}',
                         'Patient Name: {{patient_name}}',
                         'Patient Contact: {{patient_phone}}',
                    ],
               }),
          };
     }

     if (eventCode.startsWith('APPOINTMENT_')) {
          return {
               variables: appointmentVariables(),
               requiredReferences: ['appointmentId'],
               template: makeTemplate(eventCode, {
                    subject: 'Appointment Notice - {{patient_name}} - {{appointment_date}} {{appointment_time}}',
                    title: 'Appointment Notification',
                    intro: 'An appointment-related update has been recorded for this patient.',
                    details: [
                         'Appointment ID: {{appointment_id}}',
                         'Date: {{appointment_date}}',
                         'Time: {{appointment_time}}',
                         'Practitioner: {{practitioner_name}}',
                         'Location: {{appointment_location}}',
                    ],
               }),
          };
     }

     if (eventCode.startsWith('SAMPLE_')) {
          return {
               variables: sampleVariables(),
               requiredReferences: ['ascensionId'],
               template: makeTemplate(eventCode, {
                    subject: 'Sample Workflow Update - {{patient_name}} - Test {{test_id}}',
                    title: 'Sample Workflow Notification',
                    intro: 'A sample processing milestone has been reached for this patient transaction.',
                    details: [
                         'Ascension ID: {{ascension_id}}',
                         'Sample ID: {{sample_id}}',
                         'Test ID: {{test_id}}',
                         'Test Name: {{test_name}}',
                         'Collection Start: {{collection_start_time}}',
                         'Collection End: {{collection_end_time}}',
                         'Rejection Reason: {{sample_rejection_reason}}',
                    ],
               }),
          };
     }

     if (eventCode.startsWith('RESULT_') || eventCode === 'CRITICAL_RESULT') {
          return {
               variables: sampleVariables(),
               requiredReferences: ['ascensionId'],
               template: makeTemplate(eventCode, {
                    subject: 'Result Update - {{patient_name}} - {{test_name}}',
                    title: 'Laboratory Result Notification',
                    intro: 'A result-related event has been recorded and is ready for authorized review.',
                    details: [
                         'Ascension ID: {{ascension_id}}',
                         'Test ID: {{test_id}}',
                         'Test Name: {{test_name}}',
                         'Patient Number: {{patient_number}}',
                    ],
               }),
          };
     }

     if (eventCode.startsWith('INVOICE_') || eventCode.startsWith('PAYMENT_') || eventCode === 'REPORT_READY') {
          return {
               variables: billingVariables(),
               requiredReferences: ['billingId'],
               template: makeTemplate(eventCode, {
                    subject: 'Billing Update - {{patient_name}} - Invoice {{billing_id}}',
                    title: 'Billing and Payment Notification',
                    intro: 'A billing or payment event has been posted for this patient account.',
                    details: [
                         'Billing ID: {{billing_id}}',
                         'Total Amount: {{amount_total}}',
                         'Amount Paid: {{amount_paid}}',
                         'Balance: {{amount_balance}}',
                         'Status: {{billing_status}}',
                    ],
               }),
          };
     }

     return {
          variables: userVariables(),
          requiredReferences: ['userId'],
          template: makeTemplate(eventCode, {
               subject: `Security Notice - ${titleFromCode(eventCode)} - {{user_name}}`,
               title: 'Security and Account Notification',
               intro: 'A security-related account event has been captured by the laboratory system.',
               details: [
                    'User ID: {{user_id}}',
                    'User Name: {{user_name}}',
                    'User Email: {{user_email}}',
               ],
          }),
     };
}

export class NotificationEventContextService {
     private connection;

     constructor(
          private eventsRepo: NotificationEventsRepo,
          private templatesRepo: NotificationTemplatesRepo,
          private variablesRepo: NotificationTemplateVariablesRepo,
          private versionsRepo: NotificationTemplateVersionsRepo,
          private tenantId: number,
     ) {
          this.connection = KnexConnection(tenantId);
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
                    ...(await this.resolvePatientContext(references.patientId as number)),
               };
          } else if (event.event_code.startsWith('APPOINTMENT_')) {
               payload = {
                    ...payload,
                    ...(await this.resolveAppointmentContext(references.appointmentId as number)),
               };
          } else if (
               event.event_code.startsWith('SAMPLE_') ||
               event.event_code.startsWith('RESULT_') ||
               event.event_code === 'CRITICAL_RESULT'
          ) {
               payload = {
                    ...payload,
                    ...(await this.resolveSampleContext(references.ascensionId as number)),
               };
          } else if (
               event.event_code.startsWith('INVOICE_') ||
               event.event_code.startsWith('PAYMENT_') ||
               event.event_code === 'REPORT_READY'
          ) {
               payload = {
                    ...payload,
                    ...(await this.resolveBillingContext(references.billingId as number)),
               };
          } else {
               payload = {
                    ...payload,
                    ...(await this.resolveUserContext(references.userId as number)),
               };
          }

          return sanitizeContext({ ...payload, ...extraContext });
     }

     private async resolvePatientContext(patientId: number): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const row = await connection('new_patients as np')
               .select(
                    'np.patientid as patient_id',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('np.patientid', patientId)
               .first();

          if (!row) throw new Error('Patient not found');

          return {
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }

     private async resolveAppointmentContext(appointmentId: number): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const row = await connection('appointments as a')
               .leftJoin('new_patients as np', 'np.patientid', 'a.patientid')
               .leftJoin('roles as rr', 'rr.employeeid', 'a.practioner')
               .select(
                    'a.refid as appointment_id',
                    'a.patientid as patient_id',
                    'a.appointment_date',
                    'a.appointment_time',
                    'a.purpose as appointment_purpose',
                    'a.location as appointment_location',
                    'a.practioner as practitioner_id',
                    'rr.username as practitioner_name',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('a.refid', appointmentId)
               .first();

          if (!row) throw new Error('Appointment not found');

          return {
               appointment_id: row.appointment_id,
               appointment_date: row.appointment_date,
               appointment_time: row.appointment_time,
               appointment_purpose: row.appointment_purpose,
               appointment_location: row.appointment_location,
               practitioner_id: row.practitioner_id,
               practitioner_name: row.practitioner_name,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }

     private async resolveSampleContext(ascensionId: number): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const row = await connection('test_ascension as ta')
               .leftJoin('samplestatus as ss', 'ss.ascensionid', 'ta.id')
               .leftJoin('billing as b', 'b.billingid', 'ta.billingid')
               .leftJoin('new_patients as np', 'np.patientid', 'b.patientid')
               .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
               .leftJoin('roles as rc', 'rc.employeeid', 'ta.sampleCollectedBy')
               .select(
                    'ta.id as ascension_id',
                    'ta.testid as test_id',
                    'ta.billingid as billing_id',
                    'ta.collectionStartDate as collection_start_time',
                    'ta.collectionEndDate as collection_end_time',
                    'ss.keyid as sample_id',
                    'ss.rejectionmessage as sample_rejection_reason',
                    'tp.name as test_name',
                    'rc.username as collected_by_name',
                    'np.patientid as patient_id',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('ta.id', ascensionId)
               .first();

          if (!row) throw new Error('Sample/ascension record not found');

          return {
               ascension_id: row.ascension_id,
               sample_id: row.sample_id,
               test_id: row.test_id,
               test_name: row.test_name,
               billing_id: row.billing_id,
               collection_start_time: row.collection_start_time,
               collection_end_time: row.collection_end_time,
               sample_rejection_reason: row.sample_rejection_reason,
               collected_by_name: row.collected_by_name,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }

     private async resolveBillingContext(billingId: number): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const row = await connection('billing as b')
               .leftJoin('new_patients as np', 'np.patientid', 'b.patientid')
               .select(
                    'b.billingid as billing_id',
                    'b.totalcost as amount_total',
                    'b.paid as amount_paid',
                    'b.balance as amount_balance',
                    'b.status as billing_status',
                    'np.patientid as patient_id',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('b.billingid', billingId)
               .first();

          if (!row) throw new Error('Billing record not found');

          return {
               billing_id: row.billing_id,
               amount_total: row.amount_total,
               amount_paid: row.amount_paid,
               amount_balance: row.amount_balance,
               billing_status: row.billing_status,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }

     private async resolveUserContext(userId: number): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const row = await connection('roles')
               .select('employeeid as user_id', 'username as user_name', 'email as user_email')
               .where('employeeid', userId)
               .first();

          if (!row) throw new Error('User not found');

          return row;
     }
}
