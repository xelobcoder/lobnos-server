export type CommissionType = 'percentage' | 'fixed' | 'tiered' | 'hybrid' | 'sliding_scale' | 'volume' | 'quota' | 'accelerating';
export type PeriodCapReset = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface ICommissionConfig {
     id: number;
     name: string;
     description?: string;
     commission_type: CommissionType;
     quota_target?: number;
     volume_period?: PeriodCapReset;
     percentage_rate?: number;
     sliding_max_percentage?: number;
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
     quota_target?: number;
     volume_period?: PeriodCapReset;
     percentage_rate?: number;
     sliding_max_percentage?: number;
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
          this.id = data.id;
          this.name = data.name;
          this.commission_type = data.commission_type;
          this.effective_from = data.effective_from;
          this.is_active = data.is_active;
          this.created_at = data.created_at;
          this.updated_at = data.updated_at;
          Object.assign(this, data);
     }
}
