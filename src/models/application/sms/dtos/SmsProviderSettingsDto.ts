import { z } from 'zod';

export const SmsProviderSettingsSchema = z.object({
     providerType: z.literal('arkesel').optional().default('arkesel'),
     apiKey: z.string().trim().min(1).max(500).optional(),
     webhookSecret: z.string().trim().min(16).max(500).optional(),
     requireSignedWebhooks: z.boolean().optional(),
     sandbox: z.boolean().optional(),
     lowCreditThreshold: z.number().int().min(0).max(10000000).optional(),
     senderId: z.string().trim().min(1).max(11),
     baseUrl: z.string().trim().url().max(500).refine(value => {
          const url = new URL(value);
          return url.origin === 'https://sms.arkesel.com' && !url.username && !url.password && ['/','/api/v2','/api/v2/'].includes(url.pathname) && !url.search && !url.hash;
     }, 'Use https://sms.arkesel.com for the SMS API').transform(value=>new URL(value).origin),
     isActive: z.boolean().optional().default(true),
});

export type SmsProviderSettingsDto = z.infer<typeof SmsProviderSettingsSchema>;
