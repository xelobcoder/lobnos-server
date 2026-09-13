export interface IStaffFocAccount {
     id: number;
     employeeid: number;
     policy_id?: number | null;
     period_year: number;
     period_start: string | Date;
     period_end: string | Date;
     limit_amount: number;
     used_amount: number;
     remaining_amount: number;
     active: boolean;
     created_at?: string | Date;
     updated_at?: string | Date;
     staff_name?: string;
     staff_role?: string;
     staff_email?: string;
     staff_mobile?: string;
}

export interface IStaffFocTransaction {
     id?: number;
     foc_account_id: number;
     employeeid: number;
     patientid: number;
     billingid: number;
     branchid: number;
     gross_amount: number;
     foc_amount: number;
     payable_amount: number;
     status: 'pending' | 'approved' | 'rejected' | 'reversed';
     reason?: string | null;
     requested_by: number;
     approved_by?: number | null;
     approved_on?: string | Date | null;
     reversal_reason?: string | null;
     reversed_by?: number | null;
     reversed_at?: string | Date | null;
     created_at?: string | Date;
     staff_name?: string;
     patient_name?: string;
     requested_by_name?: string;
     approved_by_name?: string;
}

export interface IFocValidationResult {
     eligible: boolean;
     employeeid: number;
     patientid: number;
     focAccountId?: number;
     currentLimit: number;
     usedAmount: number;
     remainingAmount: number;
     grossRequestedAmount: number;
     focCoverage: number;
     patientPayable: number;
     requiresApproval: boolean;
     message: string;
}

export interface IStaffFocPolicy {
     id: number;
     name: string;
     limit_amount: number;
     period_type: 'YEARLY' | 'MONTHLY' | 'CUSTOM';
     requires_approval: boolean;
     allow_partial_foc: boolean;
     allow_override: boolean;
     active: boolean;
     created_at?: string | Date;
     updated_at?: string | Date;
}

/**
 * Interface defining Staff FOC Repository & Service contracts.
 * JSDoc comments explain domain invariant rules per conventions.md.
 */
export interface IStaffFocService {
     /**
      * Retrieves staff FOC account for a given employee and year.
      * Auto-provisions account if missing for an active staff member.
      */
     getStaffAccount(tenantId: number, employeeId: number, year?: number): Promise<IStaffFocAccount | null>;

     /**
      * Validates whether proposed service gross amount can be covered by staff FOC balance.
      */
     validateFocCoverage(tenantId: number, employeeId: number, patientId: number, grossAmount: number, year?: number): Promise<IFocValidationResult>;

     /**
      * Executes a Staff FOC transaction during checkout or billing request.
      * Uses pessimistic DB locking (FOR UPDATE) to guarantee atomic balance deduction.
      */
     processFocTransaction(
          tenantId: number,
          data: {
               employeeid: number;
               patientid: number;
               billingid: number;
               branchid: number;
               gross_amount: number;
               requested_by: number;
               reason?: string;
               allow_override?: boolean;
          },
          trxOverride?: any
     ): Promise<IStaffFocTransaction>;

     /**
      * Approves a pending FOC request.
      */
     approveFocTransaction(tenantId: number, transactionId: number, approverEmployeeId: number): Promise<boolean>;

     /**
      * Reverses an approved FOC transaction and restores staff FOC balance.
      */
     reverseFocTransaction(tenantId: number, transactionId: number, revokerEmployeeId: number, reason: string): Promise<boolean>;

     /**
      * Updates staff member's annual FOC limit.
      */
     updateStaffLimit(tenantId: number, employeeId: number, newLimit: number, year?: number): Promise<boolean>;

     /**
      * Lists all staff FOC accounts with pagination and filters.
      */
     getAllAccounts(tenantId: number, year?: number, search?: string, page?: number, count?: number): Promise<{ accounts: IStaffFocAccount[]; total: number }>;

     /**
      * Queries FOC transactions with filters.
      */
     getTransactions(
          tenantId: number,
          filters: {
               employeeid?: number;
               patientid?: number;
               status?: string;
               year?: number;
               from?: string;
               to?: string;
               page?: number;
               count?: number;
          }
     ): Promise<{ transactions: IStaffFocTransaction[]; total: number }>;

     /**
      * Generates summary analytics for executive FOC dashboard.
      */
     getFocSummaryReport(tenantId: number, year?: number, branchId?: number): Promise<any>;
}
