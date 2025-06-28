import { z } from 'zod';

export const CreateSmsJobRecipientSchema = z.object({
     jobId: z.number(),
     phoneE164: z.string().min(1),
     personalizedBody: z.string().min(1),
     deliveryStatus: z.enum(['queued', 'sent', 'failed', 'retrying']).optional(),
     sentAt: z.string().datetime().optional(),
     errorCode: z.string().optional(),
});

export type CreateSmsJobRecipientDto = z.infer<typeof CreateSmsJobRecipientSchema>;
