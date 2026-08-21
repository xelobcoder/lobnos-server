export type TierType = 'fixed' | 'percentage';

export interface ICommissionTier {
     id: number;
     commission_config_id: number;
     min_amount_inclusive: number;
     max_amount_exclusive?: number | null;
     tier_type: TierType;
     tier_value: number;
     sort_order: number;
     created_at: Date;
}

export class CommissionTier implements ICommissionTier {
     id!: number;
     commission_config_id!: number;
     min_amount_inclusive!: number;
     max_amount_exclusive?: number | null;
     tier_type!: TierType;
     tier_value!: number;
     sort_order!: number;
     created_at!: Date;

     constructor(data: ICommissionTier) {
          Object.assign(this, data);
     }

     isAmountInTier(amount: number): boolean {
          const minMatch = amount >= this.min_amount_inclusive;
          const maxMatch = this.max_amount_exclusive === null || this.max_amount_exclusive === undefined
               ? true
               : amount < this.max_amount_exclusive;
          return minMatch && maxMatch;
     }
}
