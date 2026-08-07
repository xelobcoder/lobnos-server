import { NotificationEventRecipientRecord } from '../types/NotificationModels';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string | null {
     if (typeof value !== 'string') return null;
     const cleaned = value.trim();
     return emailRegex.test(cleaned) ? cleaned : null;
}

function pickValues(context: Record<string, unknown>, keys: string[]): unknown[] {
     return keys.map((key) => context[key]);
}

function extractByType(type: string, context: Record<string, unknown>): string[] {
     const map: Record<string, unknown[]> = {
          PATIENT: [
               ...pickValues(context, ['patient_email', 'patientEmail']),
               (context.patient as any)?.email,
          ],
          DOCTOR: [
               ...pickValues(context, ['doctor_email', 'doctorEmail', 'user_email', 'userEmail']),
               (context.doctor as any)?.email,
          ],
          SUPPLIER: [
               ...pickValues(context, ['supplier_email', 'supplierEmail']),
               (context.supplier as any)?.email,
          ],
          ORGANIZATION: [
               ...pickValues(context, ['organization_email', 'organizationEmail']),
               (context.organization as any)?.email,
          ],
          STAFF: [
               ...pickValues(context, ['staff_email', 'staffEmail', 'employee_email', 'employeeEmail', 'user_email', 'userEmail']),
               ...(Array.isArray(context.staffEmails) ? context.staffEmails : []),
               ...(Array.isArray(context.staff_emails) ? context.staff_emails : []),
          ],
          LAB_MANAGER: pickValues(context, ['lab_manager_email', 'labManagerEmail', 'laboratory_email', 'laboratoryEmail']),
          BRANCH_MANAGER: pickValues(context, ['branch_manager_email', 'branchManagerEmail', 'branch_email', 'branchEmail']),
          ACCOUNTANT: pickValues(context, ['accountant_email', 'accountantEmail']),
     };

     return (map[type] || [])
          .map((value) => normalizeEmail(value))
          .filter((value): value is string => Boolean(value));
}

function fallbackTypesForEvent(eventCode: string): string[] {
     if (eventCode.startsWith('PATIENT_')) return ['PATIENT'];
     if (eventCode.startsWith('APPOINTMENT_')) return ['PATIENT'];
     if (eventCode.startsWith('SAMPLE_')) return ['PATIENT', 'DOCTOR'];
     if (eventCode.startsWith('RESULT_') || eventCode.startsWith('REPORT_')) return ['PATIENT'];
     if (eventCode === 'CRITICAL_RESULT') return ['LAB_MANAGER', 'DOCTOR'];
     if (eventCode.startsWith('INVOICE_') || eventCode.startsWith('PAYMENT_') || eventCode.startsWith('REFUND_')) return ['PATIENT'];
     if (eventCode.startsWith('PAYROLL_') || eventCode.startsWith('PAYSLIP_') || eventCode.startsWith('SALARY_')) return ['STAFF'];
     if (eventCode.startsWith('PURCHASE_ORDER_')) return ['SUPPLIER'];
     if (eventCode.startsWith('SUPPLIER_')) return ['SUPPLIER', 'STAFF'];
     if (eventCode.startsWith('USER_') || eventCode === 'PASSWORD_RESET') return ['DOCTOR'];
     return [];
}

export class RecipientResolver {
     resolve(
          recipientRules: NotificationEventRecipientRecord[],
          context: Record<string, unknown>,
          overrides?: { to?: string[]; cc?: string[]; bcc?: string[] },
     ) {
          const resolvedTo = new Set<string>();

          for (const rule of recipientRules.filter((row) => row.is_active)) {
               if (rule.email_override) {
                    const override = normalizeEmail(rule.email_override);
                    if (override) resolvedTo.add(override);
               }

               for (const email of extractByType(rule.recipient_type, context)) {
                    resolvedTo.add(email);
               }
          }

          for (const email of overrides?.to || []) {
               const normalized = normalizeEmail(email);
               if (normalized) resolvedTo.add(normalized);
          }

          const cc = (overrides?.cc || []).map((value) => normalizeEmail(value)).filter((value): value is string => Boolean(value));
          const bcc = (overrides?.bcc || []).map((value) => normalizeEmail(value)).filter((value): value is string => Boolean(value));

          return {
               to: Array.from(resolvedTo),
               cc,
               bcc,
          };
     }

     resolveFallback(
          eventCode: string,
          context: Record<string, unknown>,
          overrides?: { to?: string[]; cc?: string[]; bcc?: string[] },
     ) {
          const syntheticRules = fallbackTypesForEvent(eventCode).map((recipient_type) => ({
               recipient_type: recipient_type as NotificationEventRecipientRecord['recipient_type'],
               is_active: true,
          })) as NotificationEventRecipientRecord[];

          return this.resolve(syntheticRules, context, overrides);
     }
}
