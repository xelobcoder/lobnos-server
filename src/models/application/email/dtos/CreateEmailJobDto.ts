import { z } from 'zod';

export const EmailAttachmentSchema = z.object({
     filename: z.string().min(1).max(255),
     path: z.string().min(1).max(500),
     contentType: z.string().min(1).max(150).optional(),
     size: z.number().int().nonnegative().optional(),
});

export const CreateEmailJobSchema = z.object({
     templateId: z.number().int().positive().optional().nullable(),
     providerId: z.number().int().positive().optional().nullable(),
     to: z.array(z.string().email()).min(1),
     cc: z.array(z.string().email()).optional().default([]),
     bcc: z.array(z.string().email()).optional().default([]),
     subject: z.string().min(1).max(255).optional(),
     htmlBody: z.string().optional(),
     plainTextBody: z.string().optional(),
     variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
     attachments: z.array(EmailAttachmentSchema).optional().default([]),
     scheduledAt: z.string().datetime().optional().nullable(),
     priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
     referenceType: z.string().max(100).optional().nullable(),
     referenceId: z.string().max(100).optional().nullable(),
     createdBy: z.number().int().nonnegative().optional().nullable(),
});

export type CreateEmailJobDto = z.infer<typeof CreateEmailJobSchema>;
export type EmailAttachmentDto = z.infer<typeof EmailAttachmentSchema>;
