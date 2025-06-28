import { z } from 'zod';

export const CreateSmsJobSchema = z.object({
     templateId: z.number().optional(),
     customBody: z.string().optional(), // <-- allow custom message
     category: z.enum(['patient', 'clinician', 'organization']),
     recipientScope: z.enum(['single', 'multiple', 'all']),
     targetIds: z.any().optional(),
     sendType: z.enum(['immediate', 'scheduled']),
     scheduledAt: z.string().datetime().optional(),
     status: z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
     createdBy: z.number(),
}).refine(data => data.templateId || data.customBody, {
     message: 'Either templateId or customBody is required',
     path: ['templateId', 'customBody'],
});

export type CreateSmsJobDto = z.infer<typeof CreateSmsJobSchema>;
