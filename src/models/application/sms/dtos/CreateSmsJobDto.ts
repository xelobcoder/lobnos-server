import { z } from 'zod';


export const BaseSmsJobSchema = z.object({
     templateId: z.number().optional(),
     customBody: z.string().optional(), // <-- allow custom message
     category: z.enum(['patient', 'clinician', 'organization']),
     recipientScope: z.enum(['single', 'multiple', 'all']),
     targetIds: z.any().optional(),
     sendType: z.enum(['immediate', 'scheduled']),
     scheduledAt: z.preprocess(
          (val) => {
               if (typeof val === 'number') return new Date(val).toISOString();
               if (val instanceof Date) return val.toISOString();
               if (typeof val === 'string' && !isNaN(Date.parse(val))) return new Date(val).toISOString();
               return val;
          },
          z.string().datetime()
     ).optional(),
     status: z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
     createdBy: z.number(),
});

export const CreateSmsJobSchema = BaseSmsJobSchema.refine(data => data.templateId || data.customBody, {
     message: 'Either templateId or customBody is required',
     path: ['templateId', 'customBody'],
});

export const PartialSmsJobSchema = BaseSmsJobSchema.partial();

export type CreateSmsJobDto = z.infer<typeof CreateSmsJobSchema>;
