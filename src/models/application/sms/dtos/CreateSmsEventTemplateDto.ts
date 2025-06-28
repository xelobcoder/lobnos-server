import { z } from 'zod';

export const CreateSmsEventTemplateSchema = z.object({
     eventId: z.number(),
     templateId: z.number(),
     isActive: z.boolean().optional(),
});

export type CreateSmsEventTemplateDto = z.infer<typeof CreateSmsEventTemplateSchema>;
