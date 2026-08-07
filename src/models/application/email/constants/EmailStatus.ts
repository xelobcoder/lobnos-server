export const EMAIL_STATUSES = [
     'pending',
     'processing',
     'sent',
     'failed',
     'cancelled',
     'scheduled',
] as const;

export type EmailStatus = typeof EMAIL_STATUSES[number];
