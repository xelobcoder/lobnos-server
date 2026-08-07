import { z } from 'zod';
import { EMAIL_TEMPLATE_CATEGORIES } from '../constants/EmailTemplateCategory';

export const CreateEmailTemplateSchema = z.object({
     name: z.string().min(1).max(150),
     category: z.enum(EMAIL_TEMPLATE_CATEGORIES),
     subject: z.string().min(1).max(255),
     htmlBody: z.string().min(1),
     plainTextBody: z.string().optional().default(''),
     variables: z.array(z.string().min(1)).optional().default([]),
     status: z.enum(['active', 'archived']).optional().default('active'),
     createdBy: z.number().int().nonnegative().optional().nullable(),
     updatedBy: z.number().int().nonnegative().optional().nullable(),
});

export type CreateEmailTemplateDto = z.infer<typeof CreateEmailTemplateSchema>;
