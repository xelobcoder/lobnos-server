import { z } from 'zod';

export const CreateSmsJobSchema = z.object({
     templateId: z.number().optional(),
     category: z.enum(['patient', 'clinician', 'organization']),
     recipientScope: z.enum(['single', 'multiple', 'all']),
     targetIds: z.any().optional(),
     sendType: z.enum(['immediate', 'scheduled']),
     scheduledAt: z.string().datetime().optional(),
     status: z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
     createdBy: z.number(),
});

export type CreateSmsJobDto = z.infer<typeof CreateSmsJobSchema>;
