import { z } from 'zod';

export const CreateSmsCategoryMappingSchema = z.object({
     category: z.enum(['patient', 'clinician', 'organization']),
     tableName: z.string().min(1),
     idColumn: z.string().min(1),
     phoneColumn: z.string().optional(),
     nameColumn: z.string().optional(),
     additionalFields: z.any().optional(),
});

export type CreateSmsCategoryMappingDto = z.infer<typeof CreateSmsCategoryMappingSchema>;
