import { z } from 'zod';

export const CreateSmsTemplateSchema = z.object({
     name: z.string().min(1),
     body: z.string().min(1),
     category: z.enum(['patient', 'clinician', 'organization']),
     createdBy: z.number(),
});

export type CreateSmsTemplateDto = z.infer<typeof CreateSmsTemplateSchema>;
