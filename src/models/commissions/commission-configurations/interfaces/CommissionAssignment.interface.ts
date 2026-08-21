export type ScopeType = 'system' | 'organization' | 'clinician';

export interface ICommissionAssignment {
     id: number;
     commission_config_id: number;
     scope_type: ScopeType;
     scope_id?: number;
     service_id?: number;
     service_category?: string;
     priority: number;
     assigned_from: Date;
     assigned_to?: Date;
     is_active: boolean;
     created_at: Date;
     recipient_name?: string;
}

export class CommissionAssignment implements ICommissionAssignment {
     id!: number;
     commission_config_id!: number;
     scope_type!: ScopeType;
     scope_id?: number;
     service_id?: number;
     service_category?: string;
     priority!: number;
     assigned_from!: Date;
     assigned_to?: Date;
     is_active!: boolean;
     created_at!: Date;
     recipient_name?: string;

     constructor(data: ICommissionAssignment) {
          Object.assign(this, data);
     }

     isActiveOnDate(checkDate: Date): boolean {
          const afterFrom = checkDate >= this.assigned_from;
          const beforeTo = this.assigned_to === null || this.assigned_to === undefined
               ? true
               : checkDate <= this.assigned_to;
          return afterFrom && beforeTo && this.is_active;
     }

     getSpecificityScore(): number {
          const scopeScore = this.scope_type === 'clinician' ? 2 : this.scope_type === 'organization' ? 1 : 0;
          let contextScore = 1;
          if (this.service_id) contextScore = 3;
          else if (this.service_category) contextScore = 2;
          return scopeScore * 10 + contextScore;
     }
}
