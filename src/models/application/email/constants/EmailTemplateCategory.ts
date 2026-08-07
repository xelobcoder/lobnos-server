export const EMAIL_TEMPLATE_CATEGORIES = [
     'authentication',
     'patient',
     'clinician',
     'organization',
     'internal',
     'marketing',
] as const;

export type EmailTemplateCategory = typeof EMAIL_TEMPLATE_CATEGORIES[number];
