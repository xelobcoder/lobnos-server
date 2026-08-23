export type PeriodStatus = 'open' | 'soft_closed' | 'closed' | 'locked';

export interface IAccountingPeriod {
     id: number;
     period_code: string;
     period_start: Date | string;
     period_end: Date | string;
     status: PeriodStatus;
     closed_by: number | null;
     closed_at: Date | null;
     notes: string | null;
     created_at?: Date;
     updated_at?: Date;
}
