import { PayrollPeriodRepository, IPayrollPeriod } from '../../models/payroll/PayrollPeriodRepository';
import { PayrollTransactionRepository, IPayrollTransaction } from '../../models/payroll/PayrollTransactionRepository';
import { PayrollCalculationService, IPayrollCalculationInput } from './PayrollCalculationService';
import KnexConnection from '../../database/KnexConnections';

export interface IPayrollProcessingResult {
     payroll_period_id: number;
     total_employees_processed: number;
     total_gross_salary: number;
     total_deductions: number;
     total_net_salary: number;
     period_status: 'draft' | 'calculated'; // New field to indicate final status
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

     /**
      * Format date strings to YYYY-MM-DD format for calculation service
      */
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

          // If it has 'T', it's ISO format
          if (dateString.includes('T')) {
               return dateString.split('T')[0];
          }

          return dateString;
     }

     /**
      * Process payroll for a given period
      */
     async processPayrollPeriod(
          payroll_period_id: number,
          employeeIds: number[],
          calculated_by: number
     ): Promise<IPayrollProcessingResult> {
          const period = await this.periodRepo.getById(payroll_period_id);

          if (!period) {
               throw new Error(`Payroll period ${payroll_period_id} not found`);
          }

          if (period.status !== 'draft') {
               throw new Error(`Cannot process payroll period with status ${period.status}`);
          }

          const errors: Array<{ employeeid: number; error: string }> = [];
          const successfulTransactions: IPayrollTransaction[] = [];

          // Calculate payroll for each employee
          const calculationInputs: IPayrollCalculationInput[] = employeeIds.map(employeeid => ({
               employeeid,
               payroll_period_id,
               period_start_date: this.formatDateForCalculation(period.period_start_date),
               period_end_date: this.formatDateForCalculation(period.period_end_date)
          }));
          
          // Use database transaction for atomicity
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               // Create transaction-scoped repositories
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

               for (const input of calculationInputs) {
                    try {
                         const calculation = await this.calculationService.calculateEmployeePayroll(input);

                         // Check if transaction already exists
                         const existing = await trxTransactionRepo.getByEmployeeAndPeriod(
                              input.employeeid,
                              payroll_period_id
                         );

                         if (existing) {
                              // Update existing transaction
                              await trxTransactionRepo.update(existing.id!, {
                                   ...calculation,
                                   status: 'pending'
                              });
                         } else {
                              // Create new transaction
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

               // Calculate totals
               const totals = {
                    total_gross_salary: successfulTransactions.reduce((sum, t) => sum + t.gross_salary, 0),
                    total_deductions: successfulTransactions.reduce((sum, t) => sum + t.total_deductions, 0),
                    total_net_salary: successfulTransactions.reduce((sum, t) => sum + t.net_salary, 0),
                    employee_count: successfulTransactions.length
               };

               // Update period totals (always update for visibility)
               await trxPeriodRepo.updateTotals(
                    payroll_period_id,
                    totals.total_gross_salary,
                    totals.total_deductions,
                    totals.total_net_salary,
                    totals.employee_count
               );

               // Only mark as calculated if no errors occurred
               if (errors.length === 0) {
                    await trxPeriodRepo.markAsCalculated(payroll_period_id, calculated_by);
               } else {
                    // Keep period in 'draft' status when there are errors
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

     /**
      * Approve payroll period
      */
     async approvePayrollPeriod(
          payroll_period_id: number,
          approved_by: number
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status !== 'calculated') {
                    throw new Error(`Cannot approve payroll period with status ${period.status}`);
               }

               // Mark period as approved
               await trxPeriodRepo.markAsApproved(payroll_period_id, approved_by);

               // Mark all transactions as approved
               const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);

               for (const transaction of transactions) {
                    if (transaction.status === 'pending') {
                         await trxTransactionRepo.markAsApproved(transaction.id!);
                    }
               }

               return true;
          });
     }

     /**
      * Lock payroll period (prevent further changes)
      */
     async lockPayrollPeriod(
          payroll_period_id: number,
          locked_by: number
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);

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

     /**
      * Mark payroll as paid
      */
     async markPayrollAsPaid(
          payroll_period_id: number,
          payment_date: string,
          payment_method: string,
          payment_references?: Map<number, string> // employeeid -> reference
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

               const period = await trxPeriodRepo.getById(payroll_period_id);

               if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
               }

               if (period.status !== 'locked') {
                    throw new Error(`Cannot mark payroll as paid with status ${period.status}`);
               }

               // Mark all transactions as paid
               const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);

               for (const transaction of transactions) {
                    const reference = payment_references?.get(transaction.employeeid) || undefined;
                    await trxTransactionRepo.markAsPaid(
                         transaction.id!,
                         payment_date,
                         payment_method,
                         reference
                    );
               }

               // Mark period as paid
               await trxPeriodRepo.markAsPaid(payroll_period_id);

               return true;
          });
     }

     /**
      * Recalculate specific employee in payroll period
      */
     async recalculateEmployee(
          payroll_period_id: number,
          employeeid: number
     ): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);

          return connection.transaction(async (trx) => {
               const trxPeriodRepo = new PayrollPeriodRepository(this.tenantId, trx);
               const trxTransactionRepo = new PayrollTransactionRepository(this.tenantId, trx);

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

               // Recalculate period totals
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

     /**
      * Get payroll processing status
      */
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

     /**
      * Create new payroll period
      */
     async createPayrollPeriod(): Promise<number> {
          return this.periodRepo.createNextPeriod();
     }

     /**
      * Get active employees for payroll processing
      */
     async getActiveEmployees(): Promise<number[]> {
          const connection = await KnexConnection(this.tenantId);

          const employees = await connection('roles')
               .where({ activationstatus: 1 })
               .select('employeeid');

          return employees.map(e => e.employeeid);
     }
}
