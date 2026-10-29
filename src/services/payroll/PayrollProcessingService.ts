import Decimal from 'decimal.js';
import {money} from './GhanaPayrollRules';
import { PayrollPeriodRepository, IPayrollPeriod } from '../../models/payroll/PayrollPeriodRepository';
import { PayrollTransactionRepository, IPayrollTransaction } from '../../models/payroll/PayrollTransactionRepository';
import { OtherDeductionRepository } from '../../models/payroll/DeductionRepository';
import { PayrollCalculationService, IPayrollCalculationInput } from './PayrollCalculationService';
import KnexConnection from '../../database/KnexConnections';
import AutomatedExpenseLifecycle from '../../models/Expenses/AutomatedExpenseLifecycle';
import { enqueuePayrollAccrual, enqueuePayrollPayment } from '../../accountingModule/integrations/PayrollAccounting';

export interface IPayrollProcessingResult {
     payroll_period_id: number;
     total_employees_processed: number;
     total_gross_salary: number;
     total_deductions: number;
     total_net_salary: number;
     period_status: 'draft' | 'calculated';
     errors: Array<{ employeeid: number; error: string }>;
}

export class PayrollProcessingService {
     private periodRepo: PayrollPeriodRepository;
     private transactionRepo: PayrollTransactionRepository;
     private calculationService: PayrollCalculationService;

     constructor(private tenantId: number) {
          this.periodRepo = new PayrollPeriodRepository(tenantId);
          this.transactionRepo = new PayrollTransactionRepository(tenantId);
          this.calculationService = new PayrollCalculationService(tenantId);
     }

     private formatDateForCalculation(dateInput: any): string {
          if (!dateInput) return '';

          let dateString: string;
          if (dateInput instanceof Date) {
               dateString = dateInput.toISOString().split('T')[0];
          } else if (typeof dateInput === 'string') {
               dateString = dateInput;
          } else {
               dateString = String(dateInput);
          }

          if (dateString.includes('T')) {
               return dateString.split('T')[0];
          }

          return dateString;
     }

     async processPayrollPeriod(
          payroll_period_id: number,
          employeeIds: number[],
          calculated_by: number
     ): Promise<IPayrollProcessingResult> {
          const period = await this.periodRepo.getById(payroll_period_id);

          if (!period) {
               throw new Error(`Payroll period ${payroll_period_id} not found`);
          }

          if (!['draft', 'calculated'].includes(period.status)) {
               throw new Error(`Cannot process payroll period with status ${period.status}`);
          }

          const errors: Array<{ employeeid: number; error: string }> = [];
          const successfulTransactions: IPayrollTransaction[] = [];

          if(!employeeIds.length||employeeIds.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error('Select valid employees for payroll');
          const calculationInputs: IPayrollCalculationInput[] = [...new Set(employeeIds)].map(employeeid => ({
               employeeid,
               payroll_period_id,
               period_start_date: this.formatDateForCalculation(period.period_start_date),
               period_end_date: this.formatDateForCalculation(period.period_end_date)
          }));

          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);
               const lockedPeriod=await trx('payroll_periods').where({id:payroll_period_id}).forUpdate().first();
               if(!lockedPeriod||!['draft','calculated'].includes(lockedPeriod.status))throw new Error('Payroll period is no longer open for calculation');

               for (const input of calculationInputs) {
                    try {
                         const calculation = await this.calculationService.calculateEmployeePayroll(input);

                         const existing = await trxTransactionRepo.getByEmployeeAndPeriod(
                              input.employeeid,
                              payroll_period_id
                         );

                         if (existing) {
                              await trxTransactionRepo.update(existing.id!, {
                                   ...calculation,
                                   status: 'pending'
                              });
                         } else {
                              await trxTransactionRepo.create({
                                   ...calculation,
                                   status: 'pending'
                              });
                         }

                         successfulTransactions.push(calculation as any);
                    } catch (error: any) {
                         errors.push({
                              employeeid: input.employeeid,
                              error: error.message || 'Unknown error'
                         });
                    }
               }

               const persisted=(await trxTransactionRepo.getByPayrollPeriod(payroll_period_id)).filter(row=>row.status!=='cancelled');
               const sum=(field:keyof IPayrollTransaction)=>money(persisted.reduce((total,row)=>total.plus(Number(row[field])||0),new Decimal(0)));
               const totals = {total_gross_salary:sum('gross_salary'),total_deductions:sum('total_deductions'),total_net_salary:sum('net_salary'),employee_count:persisted.length};

               await trxPeriodRepo.updateTotals(
                    payroll_period_id,
                    totals.total_gross_salary,
                    totals.total_deductions,
                    totals.total_net_salary,
                    totals.employee_count
               );

               if (errors.length === 0) {
                    await trxPeriodRepo.markAsCalculated(payroll_period_id, calculated_by);
               } else {
                    await trxPeriodRepo.update(payroll_period_id,{status:'draft'});
                    console.warn(`Payroll period ${payroll_period_id} has ${errors.length} errors - keeping in draft status`);
               }

               return {
                    payroll_period_id,
                    total_employees_processed: successfulTransactions.length,
                    total_gross_salary: totals.total_gross_salary,
                    total_deductions: totals.total_deductions,
                    total_net_salary: totals.total_net_salary,
                    period_status: errors.length === 0 ? 'calculated' : 'draft',
                    errors
               };
          });
     }

     async approvePayrollPeriod(
          payroll_period_id: number,
          approved_by: number
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);
               const trxDeductionRepo = new OtherDeductionRepository(this.tenantId, trx);

               // Serialize workflow transitions with processing and payment requests.
               await trx('payroll_periods').where({id: payroll_period_id}).forUpdate().first();
               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status !== 'calculated') {
                    throw new Error(`Cannot approve payroll period with status ${period.status}`);
               }

               await trxPeriodRepo.markAsApproved(payroll_period_id, approved_by);

               const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);

               for (const transaction of transactions) {
                    if (transaction.status === 'pending') {
                         await trxTransactionRepo.markAsApproved(transaction.id!);
                    }
               }

               await enqueuePayrollAccrual(this.tenantId, payroll_period_id, approved_by, trx);

               return true;
          });
     }

     async lockPayrollPeriod(
          payroll_period_id: number,
          locked_by: number
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);

               // Serialize workflow transitions with processing and payment requests.
               await trx('payroll_periods').where({id: payroll_period_id}).forUpdate().first();
               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status !== 'approved') {
                    throw new Error(`Cannot lock payroll period with status ${period.status}`);
               }

               return trxPeriodRepo.markAsLocked(payroll_period_id, locked_by);
          });
     }

     async markPayrollAsPaid(
          payroll_period_id: number,
          payment_date: string,
          payment_method: string,
          employeeid: number,
          branchid: number,
          payment_references?: Map<number, string>
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);
               const trxDeductionRepo = new OtherDeductionRepository(this.tenantId, trx);

               // Serialize workflow transitions with processing and payment requests.
               await trx('payroll_periods').where({id: payroll_period_id}).forUpdate().first();
               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status !== 'locked') {
                    throw new Error(`Cannot mark payroll as paid with status ${period.status}`);
               }

               const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);

               for (const transaction of transactions) {
                    const reference = payment_references?.get(transaction.employeeid) || undefined;
                    const deductionDetails = Array.isArray(transaction.other_deductions_detail)
                         ? transaction.other_deductions_detail
                         : [];
                    let deductionSnapshotUpdated = false;

                    for (const deduction of deductionDetails) {
                         if (!deduction || !deduction.id) {
                              continue;
                         }

                         if (deduction.type === 'income_tax') {
                              continue;
                         }

                         const appliedAmount = Number(deduction.amount) || 0;
                         if (appliedAmount <= 0) {
                              continue;
                         }

                         const applied = await trxDeductionRepo.applyPaymentToDeduction(
                              Number(deduction.id),
                              appliedAmount,
                              payroll_period_id,
                              transaction.id!,
                              `Payroll payment for period ${payroll_period_id}`
                         );

                         if (!applied) {
                              continue;
                         }

                         const refreshedDeduction = await trxDeductionRepo.getById(Number(deduction.id));
                         if (refreshedDeduction) {
                              deduction.remaining_balance = Math.round((Number(refreshedDeduction.remaining_balance ?? 0)) * 100) / 100;
                              deduction.is_active = Boolean(refreshedDeduction.is_active);
                              deductionSnapshotUpdated = true;
                         }
                    }

                    if (deductionSnapshotUpdated) {
                         await trxTransactionRepo.update(transaction.id!, {
                              other_deductions_detail: deductionDetails
                         });
                    }

                    await trxTransactionRepo.markAsPaid(
                         transaction.id!,
                         payment_date,
                         payment_method,
                         reference
                    );
               }

               await trxPeriodRepo.markAsPaid(payroll_period_id);

               const totalNetSalary = Number(period.total_net_salary || 0);

               const lifecycle = new AutomatedExpenseLifecycle(this.tenantId);
               const lifecycleResult = await lifecycle.process({
                    amount: totalNetSalary,
                    name: `Payroll Expense - ${period.period_name} (${payroll_period_id})`,
                    description: `Payroll for ${period.period_name} (${period.period_start_date} to ${period.period_end_date}) paid on ${payment_date}`,
                    categoryName: "salary",
                    merchantName: "PAYROLL",
                    merchantEmail: "system-payroll-automated",
                    date: new Date(payment_date),
                    branchid,
                    employeeid,
                    paymentMethod: payment_method,
                    invoicePrefix: "PAYROLL"
               }, trx);

               await trx('payroll_periods')
                    .where({ id: payroll_period_id })
                    .update({
                         expense_synced: true,
                         expense_id: lifecycleResult.expenseId,
                         expense_invoice_id: lifecycleResult.invoiceId,
                         expense_payment_id: lifecycleResult.paymentId || null,
                         updated_at: trx.fn.now()
                    });

               await enqueuePayrollPayment(
                    this.tenantId,
                    payroll_period_id,
                    payment_method,
                    payment_date,
                    employeeid,
                    trx
               );

               return true;
          });
     }

     async revertPayrollPeriodStatus(
          payroll_period_id: number,
          targetStatus: 'draft' | 'calculated' | 'approved',
          clearProcessingRecords: boolean = false
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

               // Serialize workflow transitions with processing and payment requests.
               await trx('payroll_periods').where({id: payroll_period_id}).forUpdate().first();
               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status === 'paid') {
                    throw new Error('Cannot revert a paid payroll period. Reverse payment first.');
               }

               const allowedCurrentStatuses: Array<IPayrollPeriod['status']> = ['draft', 'calculated', 'approved', 'locked'];
               if (!allowedCurrentStatuses.includes(period.status)) {
                    throw new Error(`Cannot revert payroll period with status ${period.status}`);
               }

               const statusOrder: Record<'draft' | 'calculated' | 'approved' | 'locked', number> = {
                    draft: 1,
                    calculated: 2,
                    approved: 3,
                    locked: 4
               };

               if (statusOrder[targetStatus] > statusOrder[period.status as 'draft' | 'calculated' | 'approved' | 'locked']) {
                    throw new Error(`Cannot move payroll period forward to ${targetStatus} using revert`);
               }

               if (targetStatus === 'draft' && clearProcessingRecords) {
                    await trx('payroll_transactions').where({ payroll_period_id }).delete();
                    await trxPeriodRepo.updateTotals(payroll_period_id, 0, 0, 0, 0);
               }

               const transactionStatus = targetStatus === 'approved' ? 'approved' : 'pending';
               await trxTransactionRepo.updateStatusByPayrollPeriod(payroll_period_id, transactionStatus);
               await trxPeriodRepo.revertWorkflowStatus(payroll_period_id, targetStatus);

               return true;
          });
     }

     async recalculateEmployee(
          payroll_period_id: number,
          employeeid: number
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

               // Serialize workflow transitions with processing and payment requests.
               await trx('payroll_periods').where({id: payroll_period_id}).forUpdate().first();
               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status === 'locked' || period.status === 'paid') {
                    throw new Error(`Cannot recalculate payroll in ${period.status} status`);
               }

               const calculation = await this.calculationService.calculateEmployeePayroll({
                    employeeid,
                    payroll_period_id,
                    period_start_date: this.formatDateForCalculation(period.period_start_date),
                    period_end_date: this.formatDateForCalculation(period.period_end_date)
               });

               const existing = await trxTransactionRepo.getByEmployeeAndPeriod(
                    employeeid,
                    payroll_period_id
               );

               if (existing) {
                    await trxTransactionRepo.update(existing.id!, calculation as any);
               } else {
                    await trxTransactionRepo.create({
                         ...calculation,
                         status: 'pending'
                    } as any);
               }

               const totals = await trxTransactionRepo.getTotalsByPeriod(payroll_period_id);
               await trxPeriodRepo.updateTotals(
                    payroll_period_id,
                    totals.total_gross,
                    totals.total_deductions,
                    totals.total_net,
                    totals.employee_count
               );

               return true;
          });
     }

     async recalculatePayrollPeriod(
          payroll_period_id: number,
          recalculated_by: number
     ): Promise<IPayrollProcessingResult> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

               // Serialize workflow transitions with processing and payment requests.
               await trx('payroll_periods').where({id: payroll_period_id}).forUpdate().first();
               const period = await trxPeriodRepo.getById(payroll_period_id);
               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status === 'locked' || period.status === 'paid') {
                    throw new Error(`Cannot recalculate payroll period in ${period.status} status`);
               }

               const existingTransactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);
               const employeeIds = existingTransactions.length
                    ? existingTransactions.map((t) => t.employeeid)
                    : await this.getActiveEmployees();

               if (!employeeIds.length) {
                    throw new Error('No employees found to recalculate for this payroll period');
               }

               const errors: Array<{ employeeid: number; error: string }> = [];
               const successfulTransactions: IPayrollTransaction[] = [];

               for (const employeeid of employeeIds) {
                    try {
                         const calculation = await this.calculationService.calculateEmployeePayroll({
                              employeeid,
                              payroll_period_id,
                              period_start_date: this.formatDateForCalculation(period.period_start_date),
                              period_end_date: this.formatDateForCalculation(period.period_end_date)
                         });

                         const existing = await trxTransactionRepo.getByEmployeeAndPeriod(employeeid, payroll_period_id);
                         if (existing) {
                              await trxTransactionRepo.update(existing.id!, {
                                   ...calculation,
                                   status: 'pending'
                              });
                         } else {
                              await trxTransactionRepo.create({
                                   ...calculation,
                                   status: 'pending'
                              });
                         }

                         successfulTransactions.push(calculation as any);
                    } catch (error: any) {
                         errors.push({
                              employeeid,
                              error: error.message || 'Unknown error'
                         });
                    }
               }

               const persisted=(await trxTransactionRepo.getByPayrollPeriod(payroll_period_id)).filter(row=>row.status!=='cancelled');
               const sum=(field:keyof IPayrollTransaction)=>money(persisted.reduce((total,row)=>total.plus(Number(row[field])||0),new Decimal(0)));
               const totals = {total_gross_salary:sum('gross_salary'),total_deductions:sum('total_deductions'),total_net_salary:sum('net_salary'),employee_count:persisted.length};

               await trxPeriodRepo.updateTotals(
                    payroll_period_id,
                    totals.total_gross_salary,
                    totals.total_deductions,
                    totals.total_net_salary,
                    totals.employee_count
               );

               if (errors.length === 0) {
                    await trxPeriodRepo.markAsCalculated(payroll_period_id, recalculated_by);
               } else {
                    await trxPeriodRepo.update(payroll_period_id, {status: 'draft'});
               }

               return {
                    payroll_period_id,
                    total_employees_processed: successfulTransactions.length,
                    total_gross_salary: totals.total_gross_salary,
                    total_deductions: totals.total_deductions,
                    total_net_salary: totals.total_net_salary,
                    period_status: errors.length === 0 ? 'calculated' : 'draft',
                    errors
               };
          });
     }

     async getPayrollStatus(payroll_period_id: number): Promise<{
          period: IPayrollPeriod | undefined;
          transaction_count: number;
          status_breakdown: { [status: string]: number };
     }> {
          const period = await this.periodRepo.getById(payroll_period_id);
          const transactions = await this.transactionRepo.getByPayrollPeriod(payroll_period_id);

          const statusBreakdown: { [status: string]: number } = {};
          transactions.forEach(t => {
               statusBreakdown[t.status] = (statusBreakdown[t.status] || 0) + 1;
          });

          return {
               period,
               transaction_count: transactions.length,
               status_breakdown: statusBreakdown
          };
     }

     async createPayrollPeriod(): Promise<number> {
          return this.periodRepo.createNextPeriod();
     }

     async getActiveEmployees(): Promise<number[]> {
          const connection = await KnexConnection(this.tenantId);

          const employees = await connection('roles')
               .where({ activationstatus: 1 })
               .select('employeeid');

          return employees.map(e => e.employeeid);
     }
}
