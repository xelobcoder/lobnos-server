export const EMAIL_PROVIDER_TYPES = ['smtp'] as const;

export type EmailProviderType = typeof EMAIL_PROVIDER_TYPES[number];
