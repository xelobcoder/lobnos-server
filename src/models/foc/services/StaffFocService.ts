import KnexConnection from '../../../database/KnexConnections';
import logger from '../../../hooks/logger';
import { IFocValidationResult, IStaffFocAccount, IStaffFocService, IStaffFocTransaction } from '../interfaces/IStaffFocService';
import { StaffFocRepository } from '../repositories/StaffFocRepository';

export class StaffFocService implements IStaffFocService {
     private repo: StaffFocRepository;

     constructor() {
          this.repo = new StaffFocRepository();
     }

     async getStaffAccount(tenantId: number, employeeId: number, year?: number): Promise<IStaffFocAccount | null> {
          const targetYear = year || new Date().getFullYear();
          let account = await this.repo.getAccount(tenantId, employeeId, targetYear);

          if (!account) {
               // Auto-provision account if staff exists and is active in roles
               const conn = await KnexConnection(tenantId);
               const staff = await conn('roles').where({ employeeid: employeeId, activation: 1 }).first();
               if (staff) {
                    const policy = await this.repo.getPolicy(tenantId);
                    const limitAmount = Number(policy?.limit_amount || 1000.00);
                    const periodStart = `${targetYear}-01-01`;
                    const periodEnd = `${targetYear}-12-31`;

                    await this.repo.createAccount(tenantId, {
                         employeeid: employeeId,
                         policy_id: policy?.id || null,
                         period_year: targetYear,
                         period_start: periodStart,
                         period_end: periodEnd,
                         limit_amount: limitAmount,
                         used_amount: 0.00,
                         remaining_amount: limitAmount,
                         active: true,
                    });

                    account = await this.repo.getAccount(tenantId, employeeId, targetYear);
               }
          }

          return account;
     }

     async validateFocCoverage(
          tenantId: number,
          employeeId: number,
          patientId: number,
          grossAmount: number,
          year?: number
     ): Promise<IFocValidationResult> {
          const targetYear = year || new Date().getFullYear();
          const account = await this.getStaffAccount(tenantId, employeeId, targetYear);

          if (!account || !account.active) {
               return {
                    eligible: false,
                    employeeid: employeeId,
                    patientid: patientId,
                    currentLimit: 0,
                    usedAmount: 0,
                    remainingAmount: 0,
                    grossRequestedAmount: grossAmount,
                    focCoverage: 0,
                    patientPayable: grossAmount,
                    requiresApproval: false,
                    message: 'Staff member is not active or eligible for FOC medical benefit.',
               };
          }

          const policy = await this.repo.getPolicy(tenantId);
          const currentLimit = Number(account.limit_amount);
          const usedAmount = Number(account.used_amount);
          const remainingAmount = Number(account.remaining_amount);

          if (remainingAmount <= 0) {
               return {
                    eligible: true,
                    employeeid: employeeId,
                    patientid: patientId,
                    focAccountId: account.id,
                    currentLimit,
                    usedAmount,
                    remainingAmount: 0,
                    grossRequestedAmount: grossAmount,
                    focCoverage: 0,
                    patientPayable: grossAmount,
                    requiresApproval: Boolean(policy?.requires_approval),
                    message: 'Staff FOC annual allowance has been fully exhausted (GHS 0.00 remaining).',
               };
          }

          const allowPartial = policy?.allow_partial_foc !== false;
          let focCoverage = 0;
          let patientPayable = grossAmount;

          if (grossAmount <= remainingAmount) {
               focCoverage = grossAmount;
               patientPayable = 0;
          } else if (allowPartial) {
               focCoverage = remainingAmount;
               patientPayable = grossAmount - remainingAmount;
          } else {
               focCoverage = 0;
               patientPayable = grossAmount;
          }

          const requiresApproval = Boolean(policy?.requires_approval);

          return {
               eligible: true,
               employeeid: employeeId,
               patientid: patientId,
               focAccountId: account.id,
               currentLimit,
               usedAmount,
               remainingAmount,
               grossRequestedAmount: grossAmount,
               focCoverage,
               patientPayable,
               requiresApproval,
               message:
                    focCoverage === grossAmount
                         ? 'Full FOC benefit coverage available.'
                         : `Partial FOC benefit coverage (GHS ${focCoverage.toFixed(2)} covered, GHS ${patientPayable.toFixed(2)} payable).`,
          };
     }

     async processFocTransaction(
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
     ): Promise<IStaffFocTransaction> {
          const currentYear = new Date().getFullYear();
          const conn = await KnexConnection(tenantId);
          const trx = trxOverride || await conn.transaction();
          const isManagedTrx = !trxOverride;

          try {
               // Ensure account exists
               await this.getStaffAccount(tenantId, data.employeeid, currentYear);

               // Pessimistic Row Lock on staff_foc_account
               const lockedAccount = await this.repo.getAccountForUpdate(tenantId, data.employeeid, currentYear, trx);
               if (!lockedAccount || !lockedAccount.active) {
                    throw new Error('Staff member is not active or eligible for FOC medical benefit.');
               }

               const policy = await this.repo.getPolicy(tenantId);
               const currentLimit = Number(lockedAccount.limit_amount);
               const usedAmount = Number(lockedAccount.used_amount);
               const remainingAmount = Number(lockedAccount.remaining_amount);
               const gross = Number(data.gross_amount);

               let focCoverage = 0;
               let patientPayable = gross;

               if (gross <= remainingAmount) {
                    focCoverage = gross;
                    patientPayable = 0;
               } else if (policy?.allow_partial_foc !== false) {
                    focCoverage = remainingAmount;
                    patientPayable = gross - remainingAmount;
               } else if (data.allow_override && policy?.allow_override) {
                    focCoverage = gross;
                    patientPayable = 0;
               } else {
                    throw new Error(`Staff FOC limit exceeded. Remaining balance GHS ${remainingAmount.toFixed(2)} is insufficient.`);
               }

               const requiresApproval = Boolean(policy?.requires_approval);
               const initialStatus = requiresApproval ? 'pending' : 'approved';

               const txId = await this.repo.createTransaction(
                    tenantId,
                    {
                         foc_account_id: lockedAccount.id,
                         employeeid: data.employeeid,
                         patientid: data.patientid,
                         billingid: data.billingid,
                         branchid: data.branchid || 1,
                         gross_amount: gross,
                         foc_amount: focCoverage,
                         payable_amount: patientPayable,
                         status: initialStatus,
                         reason: data.reason || 'Staff Medical Benefit',
                         requested_by: data.requested_by,
                         approved_by: initialStatus === 'approved' ? data.requested_by : null,
                         approved_on: initialStatus === 'approved' ? new Date() : null,
                    },
                    trx
               );

               // Update account cached balance if auto-approved
               if (initialStatus === 'approved') {
                    const newUsed = usedAmount + focCoverage;
                    const newRemaining = Math.max(0, currentLimit - newUsed);
                    await this.repo.updateAccountBalance(tenantId, lockedAccount.id, newUsed, newRemaining, trx);
               }

               if (isManagedTrx) {
                    await trx.commit();
               }

               const transaction = await this.repo.getTransactionById(tenantId, txId, isManagedTrx ? undefined : trx);
               return transaction!;
          } catch (error: any) {
               if (isManagedTrx) {
                    await trx.rollback();
               }
               logger.error('[StaffFocService] Failed to process FOC transaction:', error);
               throw new Error(error.message || 'Failed to process Staff FOC transaction');
          }
     }

     async approveFocTransaction(tenantId: number, transactionId: number, approverEmployeeId: number): Promise<boolean> {
          const conn = await KnexConnection(tenantId);
          const trx = await conn.transaction();

          try {
               const tx = await this.repo.getTransactionById(tenantId, transactionId, trx);
               if (!tx || tx.status !== 'pending') {
                    throw new Error('Transaction is not in pending approval status.');
               }

               const year = new Date(tx.created_at || new Date()).getFullYear();
               const lockedAccount = await this.repo.getAccountForUpdate(tenantId, tx.employeeid, year, trx);
               if (!lockedAccount) {
                    throw new Error('Associated staff FOC account not found.');
               }

               const currentLimit = Number(lockedAccount.limit_amount);
               const usedAmount = Number(lockedAccount.used_amount);
               const focCoverage = Number(tx.foc_amount);

               const newUsed = usedAmount + focCoverage;
               const newRemaining = Math.max(0, currentLimit - newUsed);

               await this.repo.updateAccountBalance(tenantId, lockedAccount.id, newUsed, newRemaining, trx);
               await this.repo.updateTransactionStatus(tenantId, transactionId, 'approved', approverEmployeeId, trx);

               await trx.commit();
               return true;
          } catch (error) {
               await trx.rollback();
               logger.error('[StaffFocService] Failed to approve FOC transaction:', error);
               throw error;
          }
     }

     async reverseFocTransaction(tenantId: number, transactionId: number, revokerEmployeeId: number, reason: string): Promise<boolean> {
          const conn = await KnexConnection(tenantId);
          const trx = await conn.transaction();

          try {
               const tx = await this.repo.getTransactionById(tenantId, transactionId, trx);
               if (!tx || tx.status !== 'approved') {
                    throw new Error('Only approved FOC transactions can be reversed.');
               }

               const year = new Date(tx.created_at || new Date()).getFullYear();
               const lockedAccount = await this.repo.getAccountForUpdate(tenantId, tx.employeeid, year, trx);
               if (!lockedAccount) {
                    throw new Error('Associated staff FOC account not found.');
               }

               const currentLimit = Number(lockedAccount.limit_amount);
               const usedAmount = Number(lockedAccount.used_amount);
               const focCoverage = Number(tx.foc_amount);

               const newUsed = Math.max(0, usedAmount - focCoverage);
               const newRemaining = Math.min(currentLimit, currentLimit - newUsed);

               await this.repo.updateAccountBalance(tenantId, lockedAccount.id, newUsed, newRemaining, trx);

               const serviceRows = await trx('dboservices')
                    .where({
                         billingid: tx.billingid,
                         foc_transaction_id: transactionId,
                    })
                    .select('serviceid', 'totalpayable', 'paidamount', 'foc_amount');

               for (const serviceRow of serviceRows) {
                    const serviceFocAmount = Number(serviceRow.foc_amount || 0);
                    const paidAfterReversal = Math.max(0, Number(serviceRow.paidamount || 0) - serviceFocAmount);
                    const outstandingAfterReversal = Math.max(0, Number(serviceRow.totalpayable || 0) - paidAfterReversal);

                    await trx('dboservices')
                         .where({ serviceid: serviceRow.serviceid })
                         .update({
                              foc_amount: 0,
                              paidamount: paidAfterReversal,
                              outstanding: outstandingAfterReversal,
                              paymentstatus: outstandingAfterReversal === 0
                                   ? 'Paid'
                                   : paidAfterReversal > 0
                                        ? 'partial'
                                        : 'pending',
                         });
               }

               const billingTotals = await trx('dboservices')
                    .where({ billingid: tx.billingid })
                    .sum({ totalpayable: 'totalpayable' })
                    .sum({ paidamount: 'paidamount' })
                    .sum({ outstanding: 'outstanding' })
                    .first();
               const billingPayable = Number(billingTotals?.totalpayable || 0);
               const billingPaid = Number(billingTotals?.paidamount || 0);
               const billingOutstanding = Math.max(0, Number(billingTotals?.outstanding || billingPayable - billingPaid));

               await trx('billing')
                    .where({ billingid: tx.billingid })
                    .update({
                         paid: billingPaid,
                         outstanding: billingOutstanding,
                         balance: billingPaid > billingPayable ? billingPaid - billingPayable : 0,
                         status: billingOutstanding === 0 ? 'paid' : billingPaid > 0 ? 'partial' : 'pending',
                         clientstatus: billingOutstanding === 0 ? 'paid' : billingPaid > 0 ? 'partial' : 'pending',
                    });

               await this.repo.updateTransactionStatus(tenantId, transactionId, 'reversed', revokerEmployeeId, trx, reason);

               await trx.commit();
               return true;
          } catch (error) {
               await trx.rollback();
               logger.error('[StaffFocService] Failed to reverse FOC transaction:', error);
               throw error;
          }
     }

     async updateStaffLimit(tenantId: number, employeeId: number, newLimit: number, year?: number): Promise<boolean> {
          const targetYear = year || new Date().getFullYear();
          const account = await this.getStaffAccount(tenantId, employeeId, targetYear);
          if (!account) return false;

          await this.repo.updateAccountLimit(tenantId, account.id, newLimit);
          return true;
     }

     async getAllAccounts(tenantId: number, year?: number, search?: string, page = 1, count = 10) {
          const targetYear = year || new Date().getFullYear();
          return await this.repo.getAllAccounts(tenantId, targetYear, search, page, count);
     }

     async getTransactions(
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
     ) {
          return await this.repo.getTransactions(tenantId, filters);
     }

     async getFocSummaryReport(tenantId: number, year?: number, branchId?: number) {
          const targetYear = year || new Date().getFullYear();
          return await this.repo.getFocSummaryReport(tenantId, targetYear, branchId);
     }
}
