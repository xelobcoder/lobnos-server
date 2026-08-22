import { z } from 'zod';

export const commissionTrackingCreateSchema = z.object({
     service_id: z.number().int().positive(),
     service_amount: z.number().min(0),
     commission_type: z.enum([
          'percentage',
          'fixed',
          'tiered',
          'hybrid',
          'sliding_scale',
          'volume',
          'quota',
          'accelerating',
     ]),
     percentage_rate_applied: z.number().min(0).max(100).optional(),
     fixed_amount_applied: z.number().min(0).optional(),
     tier_id: z.number().int().positive().optional(),
     commission_due: z.number().min(0),
     min_cap_adjustment: z.number().min(0).optional(),
     max_cap_adjustment: z.number().min(0).optional(),
     period_cap_adjustment: z.number().min(0).optional(),
     final_commission: z.number().min(0),
     config_id: z.number().int().positive().optional(),
     assignment_id: z.number().int().positive().optional(),
     recipient_type: z.enum(['clinician', 'organization']),
     recipient_id: z.number().int().positive(),
     cap_period_reference: z.union([z.string(), z.date()]).optional(),
     calculated_at: z.union([z.string(), z.date()]).optional(),
     currency: z.string().length(3).optional(),
     status: z.enum(['pending', 'approved', 'paid', 'voided', 'adjusted']).optional(),
     created_at: z.union([z.string(), z.date()]).optional(),
     updated_at: z.union([z.string(), z.date()]).optional(),
}).strict();

export const commissionTrackingUpdateSchema = commissionTrackingCreateSchema.partial().strict();
