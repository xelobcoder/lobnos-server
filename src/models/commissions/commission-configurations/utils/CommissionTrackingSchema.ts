import { z } from 'zod';

const commissionTrackingFields = z.object({
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
     commission_due: z.number(),
     min_cap_adjustment: z.number().min(0).optional(),
     max_cap_adjustment: z.number().min(0).optional(),
     period_cap_adjustment: z.number().min(0).optional(),
     final_commission: z.number(),
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

const validSignedAdjustment = (value: { status?: string; commission_due?: number; final_commission?: number }) =>
     value.status === 'adjusted' || ((value.commission_due ?? 0) >= 0 && (value.final_commission ?? 0) >= 0);
export const commissionTrackingCreateSchema = commissionTrackingFields.refine(validSignedAdjustment, 'Only immutable adjustment rows can carry negative commission');
export const commissionTrackingUpdateSchema = commissionTrackingFields.partial().strict().refine(validSignedAdjustment, 'Only immutable adjustment rows can carry negative commission');
