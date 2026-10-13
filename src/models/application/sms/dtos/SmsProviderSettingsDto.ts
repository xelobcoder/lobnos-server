import { z } from 'zod';

export const SmsProviderSettingsSchema = z.object({
     providerType: z.literal('arkesel').optional().default('arkesel'),
     apiKey: z.string().trim().min(1).max(500).optional(),
     senderId: z.string().trim().min(1).max(11),
     baseUrl: z.string().trim().url().max(500).refine(value => {
          const url = new URL(value);
          return url.protocol === 'https:' && (url.hostname === 'arkesel.com' || url.hostname.endsWith('.arkesel.com'));
     }, 'Arkesel base URL must use HTTPS on an arkesel.com host'),
     isActive: z.boolean().optional().default(true),
});

export type SmsProviderSettingsDto = z.infer<typeof SmsProviderSettingsSchema>;
