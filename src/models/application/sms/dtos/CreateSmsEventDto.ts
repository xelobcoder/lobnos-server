import { z } from 'zod';

export const CreateSmsEventSchema = z.object({
     code: z.string().min(1),
     description: z.string().optional(),
     category: z.enum(['patient', 'clinician', 'organization']),
});

export type CreateSmsEventDto = z.infer<typeof CreateSmsEventSchema>;
