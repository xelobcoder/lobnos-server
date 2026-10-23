import { z } from 'zod';
import type { AuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { crmFail } from './CrmService';
export const negotiatedTerms = z.object({
     percentage_rate: z.number().min(0).max(100).optional(), fixed_component: z.number().min(0).max(1000000).optional(),
     min_commission: z.number().min(0).max(1000000).nullable().optional(), max_commission: z.number().min(0).max(1000000).nullable().optional(),
}).strict();
export function applyNegotiatedTerms(config: any, terms: any, actor: AuthUser) {
     if (!terms || !Object.keys(terms).length) return config;
     if (!roleAllowed(actor.role, ['admin'])) return crmFail('Only administrators can set negotiated calculation terms', 403);
     const parsed = negotiatedTerms.parse(terms);
     if (!['percentage', 'fixed', 'hybrid'].includes(config.commission_type)) return crmFail('Use commission settings to configure tiered or advanced plans');
     if (config.commission_type === 'fixed' && parsed.percentage_rate !== undefined || config.commission_type === 'percentage' && parsed.fixed_component !== undefined) return crmFail('These terms do not match the selected plan type');
     const result = { ...config, ...parsed };
     if (result.min_commission != null && result.max_commission != null && Number(result.min_commission) > Number(result.max_commission)) return crmFail('Minimum commission cannot exceed maximum commission');
     return result;
}

