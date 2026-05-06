export type CommissionType = 'percentage' | 'fixed' | 'tiered' | 'hybrid';
export type PeriodCapReset = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface ICommissionConfig {
     id: number;
     name: string;
     description?: string;
     commission_type: CommissionType;
     percentage_rate?: number;
     fixed_component?: number;
     min_commission?: number;
     max_commission?: number;
     period_cap?: number;
     period_cap_reset?: PeriodCapReset;
     effective_from: Date;
     effective_to?: Date;
     is_active: boolean;
     created_at: Date;
     updated_at: Date;
}

export class CommissionConfig implements ICommissionConfig {
     id: number;
     name: string;
     description?: string;
     commission_type: CommissionType;
     percentage_rate?: number;
     fixed_component?: number;
     min_commission?: number;
     max_commission?: number;
     period_cap?: number;
     period_cap_reset?: PeriodCapReset;
     effective_from: Date;
     effective_to?: Date;
     is_active: boolean;
     created_at: Date;
     updated_at: Date;

     constructor(data: ICommissionConfig) {
          Object.assign(this, data);
     }
}
