import { z } from 'zod';


export const BaseSmsJobSchema = z.object({
     templateId: z.number().int().positive().optional(),
     customBody: z.string().trim().min(1).max(5000).optional(),
     category: z.enum(['patient', 'clinician', 'organization']),
     recipientScope: z.enum(['single', 'multiple', 'all']),
     targetIds: z.array(z.object({
          id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive())]),
          // The saved contact is authoritative; preview reports invalid contacts.
          phone: z.union([z.string().max(40), z.number()]).transform(String).optional(),
     })).max(10000).optional(),
     sendType: z.enum(['immediate', 'scheduled']),
     scheduledAt: z.preprocess(
          (val) => {
               if (typeof val === 'number' && Number.isFinite(new Date(val).getTime())) return new Date(val).toISOString();
               if (val instanceof Date && Number.isFinite(val.getTime())) return val.toISOString();
               if (typeof val === 'string' && !isNaN(Date.parse(val))) return new Date(val).toISOString();
               return val;
          },
          z.string().datetime()
     ).optional(),
     status: z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
     createdBy: z.number().int().positive(),
});

export const CreateSmsJobSchema = BaseSmsJobSchema.superRefine((data, ctx) => {
     if (!data.templateId && !data.customBody) ctx.addIssue({ code: 'custom', message: 'Select a template or enter a message', path: ['customBody'] });
     if (data.sendType === 'scheduled' && (!data.scheduledAt || Date.parse(data.scheduledAt) <= Date.now())) {
          ctx.addIssue({ code: 'custom', message: 'Choose a future scheduled date and time', path: ['scheduledAt'] });
     }
     if (data.recipientScope !== 'all' && (!data.targetIds?.length || (data.recipientScope === 'single' && data.targetIds.length !== 1))) {
          ctx.addIssue({ code: 'custom', message: 'Select the recipients for this campaign', path: ['targetIds'] });
     }
});

export const PartialSmsJobSchema = BaseSmsJobSchema.partial();

export type CreateSmsJobDto = z.infer<typeof CreateSmsJobSchema>;
