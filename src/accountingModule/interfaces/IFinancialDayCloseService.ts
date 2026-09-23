import { AuthUser } from '../../middleware/authority';

export type FinancialDayCloseStatus = 'draft' | 'accountant_submitted' | 'returned_to_accountant' | 'manager_approved' | 'finalized';

export interface FinancialCloseActionInput {
     pin: string;
     expectedVersion?: number;
     notes?: string;
     timezone?: string;
     requestContext?: { ipAddress?: string | null; userAgent?: string | null; requestId?: string | null };
}

export interface ManagerCloseDecisionInput extends FinancialCloseActionInput {
     decision: 'approve' | 'reject';
     reason?: string;
}

export interface IFinancialDayCloseService {
     /** Creates or resubmits a branch/day close after PIN verification and reconciliation. */
     submit(actor: AuthUser, branchId: number, financialDate: string, input: FinancialCloseActionInput): Promise<any>;

     /** Approves or returns an accountant submission; the manager must be a different employee. */
     managerDecision(actor: AuthUser, closureId: number, input: ManagerCloseDecisionInput): Promise<any>;

     /** Permanently finalizes a manager-approved day and creates immutable source-record manifests. */
     finalize(actor: AuthUser, closureId: number, input: FinancialCloseActionInput): Promise<any>;

     list(filters?: { branchId?: number; from?: string; to?: string; status?: FinancialDayCloseStatus; page?: number; count?: number }): Promise<any>;

     detail(actor: AuthUser, closureId: number): Promise<any>;
}
