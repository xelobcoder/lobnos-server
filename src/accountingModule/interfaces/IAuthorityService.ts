export type AuthorityPermission =
     | 'expense.create'
     | 'expense.view'
     | 'expense.edit'
     | 'expense.submit'
     | 'expense.approve'
     | 'expense.reject'
     | 'expense.pay'
     | 'expense.cancel'
     | 'expense.reverse'
     | 'expense.override_approval'
     | 'expense.override_sod'
     | 'expense.view_audit'
     | 'expense.configure'
     | 'payment_account.manage'
     | 'purchase_order.approve'
     | 'purchase_order.pay'
     | 'inventory.adjust'
     | 'accounting.journal.approve'
     | 'accounting.journal.post'
     | 'accounting.period.close'
     | 'accounting.daily_close.submit'
     | 'accounting.daily_close.manager_approve'
     | 'accounting.daily_close.finalize'
     | 'accounting.daily_close.view_audit'
     | 'accounting.financial_correction.execute'
     | 'billing.refund.approve';

export interface AuthorityDelegation {
     id: number;
     employeeid: number;
     permission: AuthorityPermission;
     min_amount: number | null;
     max_amount: number | null;
     branchid: number | null;
     is_active: boolean;
     granted_by: number | null;
     granted_at: Date;
     revoked_by: number | null;
     revoked_at: Date | null;
     expires_at: Date | null;
     notes: string | null;
     replaces_delegation_id?: number | null;
}

export interface AuthorityDecision {
     allowed: boolean;
     /** Human-readable reason, safe to surface to the user when denied. */
     reason: string;
     /** Which delegation granted it, for the audit trail. Null when granted by role. */
     delegationId: number | null;
     source: 'role' | 'delegation' | 'denied';
}

export interface GrantDelegationInput {
     employeeid: number;
     permission: AuthorityPermission;
     minAmount?: number | null;
     maxAmount?: number | null;
     branchid?: number | null;
     expiresAt?: Date | string | null;
     notes?: string | null;
     grantedBy: number;
}

export interface IAuthorityService {
     /**
      * Decides whether an employee may perform an action, optionally for a given amount.
      *
      * Owners and admins always pass. Everyone else needs an active, unexpired delegation, and for
      * payment permissions the amount must fall inside the delegated band — this is what lets a
      * facility owner say "the manager may pay, but only between 0 and 5,000".
      *
      * An amount outside the band is denied even though the permission is held, so a delegate
      * cannot split a large payment past their ceiling by holding the permission alone.
      */
     can(employeeid: number, permission: AuthorityPermission, amount?: number | null, branchid?: number | null): Promise<AuthorityDecision>;

     /** Replaces any existing grant of the same permission for that employee. */
     grant(input: GrantDelegationInput): Promise<AuthorityDelegation>;

     revise(id: number, input: Pick<GrantDelegationInput, 'minAmount' | 'maxAmount' | 'branchid' | 'expiresAt' | 'notes' | 'grantedBy'>): Promise<AuthorityDelegation>;

     revoke(id: number, revokedBy: number): Promise<void>;

     listForEmployee(employeeid: number): Promise<AuthorityDelegation[]>;

     list(filters?: { permission?: AuthorityPermission; activeOnly?: boolean }): Promise<AuthorityDelegation[]>;
}
