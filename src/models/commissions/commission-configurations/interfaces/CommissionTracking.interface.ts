export type RecipientType = 'clinician' | 'organization';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'voided' | 'adjusted';
export type CommissionType = 'percentage' | 'fixed' | 'tiered' | 'hybrid';

export interface ICommissionTracking {
     id: number;
     service_id: number;
     service_amount: number;
     commission_type: CommissionType;
     percentage_rate_applied?: number;
     fixed_amount_applied?: number;
     tier_id?: number;
     commission_due: number;
     min_cap_adjustment: number;
     max_cap_adjustment: number;
     period_cap_adjustment: number;
     final_commission: number;
     config_id?: number;
     assignment_id?: number;
     recipient_type: RecipientType;
     recipient_id: number;
     cap_period_reference?: Date;
     calculated_at: Date;
     currency: string;
     status: CommissionStatus;
     notes?: string;
     created_at: Date;
     updated_at: Date;
}

export class CommissionTracking implements ICommissionTracking {
     id: number;
     service_id: number;
     service_amount: number;
     commission_type: CommissionType;
     percentage_rate_applied?: number;
     fixed_amount_applied?: number;
     tier_id?: number;
     commission_due: number;
     min_cap_adjustment: number;
     max_cap_adjustment: number;
     period_cap_adjustment: number;
     final_commission: number;
     config_id?: number;
     assignment_id?: number;
     recipient_type: RecipientType;
     recipient_id: number;
     cap_period_reference?: Date;
     calculated_at: Date;
     currency: string;
     status: CommissionStatus;
     notes?: string;
     created_at: Date;
     updated_at: Date;

     constructor(data: ICommissionTracking) {
          Object.assign(this, data);
     }

     getTotalAdjustments(): number {
          return (this.min_cap_adjustment || 0) + (this.max_cap_adjustment || 0) + (this.period_cap_adjustment || 0);
     }

     isFullyAdjusted(): boolean {
          return this.commission_due > 0 && this.final_commission === 0;
     }
}
