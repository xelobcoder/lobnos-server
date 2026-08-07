import { z } from 'zod';
import { EMAIL_PROVIDER_TYPES } from '../constants/EmailProviderType';

export const CreateEmailProviderSchema = z.object({
     name: z.string().min(1).max(150),
     providerType: z.enum(EMAIL_PROVIDER_TYPES),
     host: z.string().min(1).max(255),
     port: z.number().int().positive(),
     secure: z.boolean().optional().default(false),
     username: z.string().min(1).max(255),
     password: z.string().min(1).max(255),
     fromEmail: z.string().email(),
     fromName: z.string().min(1).max(150),
     isDefault: z.boolean().optional().default(false),
     isActive: z.boolean().optional().default(true),
     createdBy: z.number().int().nonnegative().optional().nullable(),
     updatedBy: z.number().int().nonnegative().optional().nullable(),
});

export type CreateEmailProviderDto = z.infer<typeof CreateEmailProviderSchema>;
