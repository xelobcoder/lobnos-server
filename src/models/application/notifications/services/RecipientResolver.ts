import { NotificationEventRecipientRecord } from '../types/NotificationModels';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string | null {
     if (typeof value !== 'string') return null;
     const cleaned = value.trim();
     return emailRegex.test(cleaned) ? cleaned : null;
}

function extractByType(type: string, context: Record<string, unknown>): string[] {
     const map: Record<string, unknown[]> = {
          PATIENT: [context.patientEmail, (context.patient as any)?.email],
          DOCTOR: [context.doctorEmail, (context.doctor as any)?.email],
          ORGANIZATION: [context.organizationEmail, (context.organization as any)?.email],
          STAFF: [context.staffEmail, ...(Array.isArray(context.staffEmails) ? context.staffEmails : [])],
          LAB_MANAGER: [context.labManagerEmail],
          BRANCH_MANAGER: [context.branchManagerEmail],
          ACCOUNTANT: [context.accountantEmail],
     };

     return (map[type] || [])
          .map((value) => normalizeEmail(value))
          .filter((value): value is string => Boolean(value));
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
}
