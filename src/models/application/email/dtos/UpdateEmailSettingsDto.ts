import { z } from 'zod';

export const UpdateEmailSettingsSchema = z.object({
     defaultProviderId: z.number().int().positive().optional().nullable(),
     maxAttachmentSizeMb: z.number().positive().optional(),
     maxRetries: z.number().int().min(0).max(10).optional(),
     retryBackoffMinutes: z.array(z.number().int().min(1).max(1440)).max(10).optional(),
     allowMarketingEmails: z.boolean().optional(),
     updatedBy: z.number().int().nonnegative().optional().nullable(),
});

export type UpdateEmailSettingsDto = z.infer<typeof UpdateEmailSettingsSchema>;
