import { z } from 'zod';

export const RetryEmailSchema = z.object({
     queueId: z.number().int().positive(),
     forceImmediate: z.boolean().optional().default(false),
});

export type RetryEmailDto = z.infer<typeof RetryEmailSchema>;
