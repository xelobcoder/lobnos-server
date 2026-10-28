import { z } from 'zod';

export const CreateSmsTemplateSchema = z.object({
     name: z.string().trim().min(1).max(200),
     body: z.string().trim().min(1).max(5000),
     category: z.enum(['patient', 'clinician', 'organization']),
     createdBy: z.number().int().positive(),
});

export type CreateSmsTemplateDto = z.infer<typeof CreateSmsTemplateSchema>;
