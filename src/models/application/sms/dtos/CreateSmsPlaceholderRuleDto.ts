import { z } from 'zod';

export const CreateSmsPlaceholderRuleSchema = z.object({
     category: z.enum(['patient', 'clinician', 'organization']),
     placeholder: z.string().min(1),
     columnName: z.string().min(1),
     tableName: z.string().min(1),
     description: z.string().optional(),
});

export type CreateSmsPlaceholderRuleDto = z.infer<typeof CreateSmsPlaceholderRuleSchema>;
