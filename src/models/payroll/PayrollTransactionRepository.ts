import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';
import { customError } from '../../hooks/helper';

export interface IPayrollTransaction {
     id?: number;
     payroll_period_id: number;
     employeeid: number;
     basic_salary: number;
     hourly_earnings: number;
     overtime_earnings: number;
     commission_earnings: number;
     total_allowances: number;
     total_bonuses: number;
     gross_salary: number;
     income_tax: number;
     total_other_deductions: number;
     total_deductions: number;
     employeename?: string;
     employeerole?: string;
     salary_grade_id?: number;
     salary_grade?: string;
     tax_relief?: number;
     net_salary: number;
     employer_cost: number;
     days_worked: number;
     hours_worked: number;
     overtime_hours: number;
     days_absent: number;
     days_leave: number;
     status: 'pending' | 'approved' | 'paid' | 'cancelled';
     payment_date?: string;
     payment_method?: 'bank_transfer' | 'cash' | 'cheque' | 'mobile_money';
     payment_reference?: string;
     allowances_detail?: any;
     bonuses_detail?: any;
     other_deductions_detail?: any;
}

// Zod validation schema
const payrollTransactionSchema = z.object({
     payroll_period_id: z.number().positive('Payroll period ID must be a positive number'),
     employeeid: z.number().positive('Employee ID must be a positive number'),
     basic_salary: z.number().min(0, 'Basic salary cannot be negative'),
     hourly_earnings: z.number().min(0, 'Hourly earnings cannot be negative'),
     overtime_earnings: z.number().min(0, 'Overtime earnings cannot be negative'),
     commission_earnings: z.number().min(0, 'Commission earnings cannot be negative'),
     total_allowances: z.number().min(0, 'Total allowances cannot be negative'),
     total_bonuses: z.number().min(0, 'Total bonuses cannot be negative'),
     gross_salary: z.number().min(0, 'Gross salary cannot be negative'),
     income_tax: z.number().min(0, 'Income tax cannot be negative'),
     total_other_deductions: z.number().min(0, 'Total other deductions cannot be negative'),
     total_deductions: z.number().min(0, 'Total deductions cannot be negative'),
     net_salary: z.number().min(0, 'Net salary cannot be negative'),
     employer_cost: z.number().min(0, 'Employer cost cannot be negative'),
     days_worked: z.number().min(0, 'Days worked cannot be negative').max(31, 'Days worked cannot exceed 31'),
     hours_worked: z.number().min(0, 'Hours worked cannot be negative').max(744, 'Hours worked cannot exceed 744 (31 days)'),
     overtime_hours: z.number().min(0, 'Overtime hours cannot be negative'),
     days_absent: z.number().min(0, 'Days absent cannot be negative').max(31, 'Days absent cannot exceed 31'),
     days_leave: z.number().min(0, 'Days leave cannot be negative').max(31, 'Days leave cannot exceed 31'),
     status: z.enum(['pending', 'approved', 'paid', 'cancelled']),
     payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format').optional(),
     payment_method: z.enum(['bank_transfer', 'cash', 'cheque', 'mobile_money']).optional(),
     payment_reference: z.string().max(100, 'Payment reference cannot exceed 100 characters').optional(),
     allowances_detail: z.any().optional(),
     bonuses_detail: z.any().optional(),
     other_deductions_detail: z.any().optional()
}).refine((data) => {
     if (data.status === 'paid' && (!data.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.payment_date))) {
          return false;
     }
     return true;
}, {
     message: 'Payment date is required for paid transactions',
     path: ['payment_date']
});

export class PayrollTransactionRepository {
     constructor(private tenantId: number, private trx?: Knex.Transaction) { }

     private get connection(): Promise<Knex> {
          return this.trx ? Promise.resolve(this.trx) : KnexConnection(this.tenantId);
     }

     private parseJsonDetail(value: any, fallback: any[] = []): any {
          if (value === null || value === undefined || value === '') {
               return fallback;
          }

          if (typeof value === 'string') {
               try {
                    return JSON.parse(value);
               } catch {
                    return fallback;
               }
          }

          return value;
     }

     private parseTransactionDetails(transaction: any): IPayrollTransaction {
          const parsedAllowances = this.parseJsonDetail(transaction.allowances_detail);
          const normalizedAllowances = Array.isArray(parsedAllowances) ? parsedAllowances : [];
          const parsedOtherDeductions = this.parseJsonDetail(transaction.other_deductions_detail);
          const normalizedOtherDeductions = Array.isArray(parsedOtherDeductions) ? parsedOtherDeductions : [];
          const incomeTaxValue = Number(transaction.income_tax) || 0;
          const taxDetail = normalizedOtherDeductions.find((item: any) =>
               item && (item.type === 'income_tax' || item.name === 'Income Tax')
          );
          const taxReliefTotal = Number(taxDetail?.tax_relief_total) || 0;
          const hasIncomeTaxItem = normalizedOtherDeductions.some((item: any) =>
               item && (item.type === 'income_tax' || item.name === 'Income Tax')
          );

          if (!hasIncomeTaxItem && incomeTaxValue > 0) {
               normalizedOtherDeductions.unshift({
                    type: 'income_tax',
                    name: 'Income Tax',
                    amount: incomeTaxValue,
                    source: 'tax_configuration'
               });
          }

          return {
               id: transaction.id ? Number(transaction.id) : undefined,
               payroll_period_id: Number(transaction.payroll_period_id),
               employeeid: Number(transaction.employeeid),
               basic_salary: Number(transaction.basic_salary) || 0,
               hourly_earnings: Number(transaction.hourly_earnings) || 0,
               overtime_earnings: Number(transaction.overtime_earnings) || 0,
               commission_earnings: Number(transaction.commission_earnings) || 0,
               total_allowances: Number(transaction.total_allowances) || 0,
               total_bonuses: Number(transaction.total_bonuses) || 0,
               gross_salary: Number(transaction.gross_salary) || 0,
               income_tax: Number(transaction.income_tax) || 0,
               total_other_deductions: Number(transaction.total_other_deductions) || 0,
               total_deductions: Number(transaction.total_deductions) || 0,
               net_salary: Number(transaction.net_salary) || 0,
               employer_cost: Number(transaction.employer_cost) || 0,
               days_worked: Number(transaction.days_worked) || 0,
               hours_worked: Number(transaction.hours_worked) || 0,
               overtime_hours: Number(transaction.overtime_hours) || 0,
               days_absent: Number(transaction.days_absent) || 0,
               days_leave: Number(transaction.days_leave) || 0,
               employeename: transaction.username || '',
               employeerole: transaction.role || '',
               salary_grade_id: transaction.salary_grade_id ? Number(transaction.salary_grade_id) : undefined,
               salary_grade: transaction.salary_grade || undefined,
               tax_relief: Math.round(taxReliefTotal * 100) / 100,
               status: transaction.status,
               payment_date: transaction.payment_date ?
                    (transaction.payment_date instanceof Date ?
                         transaction.payment_date.toISOString().split('T')[0] :
                         String(transaction.payment_date)) :
                    undefined,
               payment_method: transaction.payment_method || undefined,
               payment_reference: transaction.payment_reference || undefined,
               allowances_detail: normalizedAllowances,
               bonuses_detail: this.parseJsonDetail(transaction.bonuses_detail),
               other_deductions_detail: normalizedOtherDeductions
          };
     }

     async create(transaction: IPayrollTransaction): Promise<number> {
          // Prepare transaction data with stringified details
          const transactionData = {
               ...transaction,
               allowances_detail: transaction.allowances_detail ? JSON.stringify(transaction.allowances_detail) : null,
               bonuses_detail: transaction.bonuses_detail ? JSON.stringify(transaction.bonuses_detail) : null,
               other_deductions_detail: transaction.other_deductions_detail ? JSON.stringify(transaction.other_deductions_detail) : null
          };

          // Validate transaction data
          payrollTransactionSchema.parse(transactionData);

          const connection = await this.connection;
          const [id] = await connection('payroll_transactions').insert(transactionData);
          return id;
     }

     async getById(id: number): Promise<IPayrollTransaction | undefined> {
          const connection = await this.connection;
          const transaction = await connection('payroll_transactions').where({ id }).first();
          return transaction ? this.parseTransactionDetails(transaction) : undefined;
     }

     async getByPayrollPeriod(payroll_period_id: number): Promise<IPayrollTransaction[]> {
          const connection = await this.connection;
          const transactions = await connection('payroll_transactions')
               .where({ payroll_period_id })
               .orderBy('employeeid', 'asc');
          return transactions.map(t => this.parseTransactionDetails(t));
     }

     async getByEmployeeId(
          page: number = 1,
          pageSize: number = 10,
          employeeid?: number | 'all'
     ): Promise<{
          data: IPayrollTransaction[];
          total: number;
          page: number;
          pageSize: number;
     }> {
          const connection = await this.connection;

          const offset = (page - 1) * pageSize;
          const baseQuery = connection('payroll_transactions')
               .modify((qb) => {
                    if (employeeid !== undefined && employeeid !== null && employeeid !== 'all') {
                         qb.where('payroll_transactions.employeeid', employeeid);
                    }
               });


          const rows = await baseQuery
               .clone()
               .leftJoin('roles', 'payroll_transactions.employeeid', 'roles.employeeid')
               .orderBy('payroll_transactions.created_at', 'desc')
               .limit(pageSize)
               .offset(offset);


          const countResult = await baseQuery
               .clone()
               .count<{ total: number }[]>({ total: '*' });

          const total = Number(countResult[0]?.total || 0);

          return {
               data: rows.map((t: any) => this.parseTransactionDetails(t)),
               total,
               page,
               pageSize
          };
     }

     async getByEmployeeAndPeriod(
          employeeid: number,
          payroll_period_id: number
     ): Promise<IPayrollTransaction | undefined> {
          const connection = await this.connection;
          const transaction = await connection('payroll_transactions')
               .where({ employeeid, payroll_period_id })
               .first();
          return transaction ? this.parseTransactionDetails(transaction) : undefined;
     }

     async update(id: number, transaction: Partial<IPayrollTransaction>): Promise<boolean> {
          // Get existing transaction for validation
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Payroll transaction not found');
          }

          // Prepare update data with stringified details
          const updateData = {
               ...transaction,
               allowances_detail: transaction.allowances_detail !== undefined ? JSON.stringify(transaction.allowances_detail) : undefined,
               bonuses_detail: transaction.bonuses_detail !== undefined ? JSON.stringify(transaction.bonuses_detail) : undefined,
               other_deductions_detail: transaction.other_deductions_detail !== undefined ? JSON.stringify(transaction.other_deductions_detail) : undefined
          };

          // Merge updates with existing data and validate
          const updatedTransaction = { ...existing, ...updateData };
          payrollTransactionSchema.parse(updatedTransaction);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_transactions')
               .where({ id })
               .update({ ...updateData, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async updateStatus(id: number, status: string): Promise<boolean> {
          const connection = await this.connection;
          const affectedRows = await connection('payroll_transactions')
               .where({ id })
               .update({ status, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async updateStatusByPayrollPeriod(payroll_period_id: number, status: 'pending' | 'approved' | 'paid' | 'cancelled'): Promise<boolean> {
          const connection = await this.connection;
          const updates: Record<string, any> = {
               status,
               updated_at: connection.fn.now()
          };

          if (status !== 'paid') {
               updates.payment_date = null;
               updates.payment_method = null;
               updates.payment_reference = null;
          }

          const affectedRows = await connection('payroll_transactions')
               .where({ payroll_period_id })
               .update(updates);
          return affectedRows >= 0;
     }

     async markAsApproved(id: number): Promise<boolean> {
          return this.updateStatus(id, 'approved');
     }

     async markAsPaid(
          id: number,
          payment_date: string,
          payment_method: string,
          payment_reference?: string
     ): Promise<boolean> {
          try {
               const connection = await this.connection;
               const affectedRows = await connection('payroll_transactions')
                    .where({ id })
                    .update({
                         status: 'paid',
                         payment_date,
                         payment_method,
                         payment_reference,
                         updated_at: connection.fn.now()
                    });
               return affectedRows > 0;
          } catch (err: any) {
               throw err;
          }
     }

     async markAsCancelled(id: number): Promise<boolean> {
          return this.updateStatus(id, 'cancelled');
     }

     async delete(id: number): Promise<boolean> {
          const connection = await this.connection;

          // Only allow deletion of pending transactions
          const transaction = await this.getById(id);
          if (!transaction || transaction.status !== 'pending') {
               return false;
          }

          const affectedRows = await connection('payroll_transactions')
               .where({ id })
               .delete();

          return affectedRows > 0;
     }

     async bulkCreate(transactions: IPayrollTransaction[]): Promise<number[]> {
          const connection = await this.connection;
          return connection('payroll_transactions').insert(transactions);
     }

     async getByStatus(status: string): Promise<IPayrollTransaction[]> {
          const connection = await this.connection;
          return connection('payroll_transactions')
               .where({ status })
               .orderBy('created_at', 'desc');
     }

     async getTotalsByPeriod(payroll_period_id: number): Promise<{
          total_gross: number;
          total_deductions: number;
          total_net: number;
          employee_count: number;
     }> {
          const connection = await this.connection;

          const result = await connection('payroll_transactions')
               .where({ payroll_period_id })
               .select(
                    connection.raw('COALESCE(SUM(gross_salary), 0) as total_gross'),
                    connection.raw('COALESCE(SUM(total_deductions), 0) as total_deductions'),
                    connection.raw('COALESCE(SUM(net_salary), 0) as total_net'),
                    connection.raw('COUNT(*) as employee_count')
               )
               .first() as any;

          return result || { total_gross: 0, total_deductions: 0, total_net: 0, employee_count: 0 };
     }

     async getEmployeeYTDTotals(employeeid: number, year: number): Promise<{
          ytd_gross: number;
          ytd_net: number;
          ytd_tax: number;
          ytd_ssnit: number;
     }> {
          const connection = await this.connection;

          const result = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .where({ 'pt.employeeid': employeeid, 'pp.period_year': year })
               .where('pt.status', 'paid')
               .select(
                    connection.raw('COALESCE(SUM(pt.gross_salary), 0) as ytd_gross'),
                    connection.raw('COALESCE(SUM(pt.net_salary), 0) as ytd_net'),
                    connection.raw('COALESCE(SUM(pt.income_tax), 0) as ytd_tax'),
                    connection.raw('0 as ytd_ssnit')
               )
               .first() as any;

          return result || { ytd_gross: 0, ytd_net: 0, ytd_tax: 0, ytd_ssnit: 0 };
     }

     async getPayrollSummaryByEmployee(
          employeeid: number,
          startDate: string,
          endDate: string
     ): Promise<IPayrollTransaction[]> {
          const connection = await this.connection;

          const rows = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .where({ 'pt.employeeid': employeeid })
               .whereBetween('pp.period_start_date', [startDate, endDate])
               .select('pt.*', 'pp.period_name', 'pp.payment_date as period_payment_date')
               .orderBy('pp.period_start_date', 'desc');

          return rows.map((row: any) => this.parseTransactionDetails(row));
     }

     async getPeriodTransactionsWithEmployeeDetails(payroll_period_id: number, count?: number, page?: number): Promise<{ data: any[], total: number, totalPages: number }> {
          const connection = await this.connection;
          const total = await connection('payroll_transactions').count('id as count').where({ payroll_period_id });
          const totalPages = count ? Math.ceil(Number(total[0].count) / count) : 1;

          const latestCompensationByEmployee = connection('payroll_employee_compensation as c1')
               .join(
                    connection('payroll_employee_compensation as c2')
                         .select('employeeid')
                         .max('effective_from as latest_effective_from')
                         .where({ is_active: true })
                         .groupBy('employeeid')
                         .as('latest_comp'),
                    function joinLatestComp() {
                         this.on('c1.employeeid', '=', 'latest_comp.employeeid')
                              .andOn('c1.effective_from', '=', 'latest_comp.latest_effective_from');
                    }
               )
               .select('c1.employeeid', 'c1.salary_grade_id')
               .as('comp');

          const query = connection('payroll_transactions as pt')
               .join('roles as r', 'pt.employeeid', 'r.employeeid')
               .leftJoin('branch as b', 'r.branch', 'b.branchid')
               .leftJoin(latestCompensationByEmployee, 'pt.employeeid', 'comp.employeeid')
               .leftJoin('payroll_salary_grades as sg', 'comp.salary_grade_id', 'sg.id')
               .where({ 'pt.payroll_period_id': payroll_period_id })
               .select(
                    'pt.*',
                    'r.username as employee_name',
                    'r.role as employee_role',
                    'r.email',
                    'b.name as branch_name',
                    'comp.salary_grade_id as salary_grade_id',
                    'sg.grade_name as salary_grade'
               )

          if (count !== undefined && page !== undefined) {
               const offset = (page - 1) * count;
               query.limit(count).offset(offset);
          }

          query.orderBy('r.username', 'asc');

          const rows = await query;
          const transactionIds = rows
               .map((row: any) => Number(row.id))
               .filter((id: number) => Number.isFinite(id) && id > 0);

          const ledgerBalanceMap = new Map<string, number>();
          if (transactionIds.length) {
               const hasLedgerTable = await connection.schema.hasTable('payroll_employee_other_deduction_ledger');
               if (hasLedgerTable) {
                    const ledgerRows = await connection('payroll_employee_other_deduction_ledger')
                         .whereIn('payroll_transaction_id', transactionIds)
                         .select('payroll_transaction_id', 'deduction_id', 'balance_after');

                    for (const ledgerRow of ledgerRows as any[]) {
                         const txnId = Number(ledgerRow.payroll_transaction_id);
                         const deductionId = Number(ledgerRow.deduction_id);
                         const balanceAfter = Number(ledgerRow.balance_after) || 0;
                         ledgerBalanceMap.set(`${txnId}:${deductionId}`, balanceAfter);
                    }
               }
          }

          return {
               data: rows.map((row: any) => {
                    const parsed = this.parseTransactionDetails(row);
                    const normalizedDeductions = Array.isArray(parsed.other_deductions_detail)
                         ? parsed.other_deductions_detail.map((deduction: any) => {
                              if (!deduction || !deduction.id) {
                                   return deduction;
                              }

                              const key = `${Number(parsed.id)}:${Number(deduction.id)}`;
                              if (!ledgerBalanceMap.has(key)) {
                                   return deduction;
                              }

                              return {
                                   ...deduction,
                                   remaining_balance: Math.round((Number(ledgerBalanceMap.get(key)) || 0) * 100) / 100
                              };
                         })
                         : [];

                    return {
                         ...parsed,
                         other_deductions_detail: normalizedDeductions,
                         allowances: parsed.allowances_detail,
                         employee_name: row.employee_name || '',
                         employee_role: row.employee_role || '',
                         email: row.email || '',
                         branch_name: row.branch_name || '',
                         salary_grade_id: row.salary_grade_id ? Number(row.salary_grade_id) : undefined,
                         salary_grade: row.salary_grade || null,
                         tax_relief: parsed.tax_relief || 0
                    };
               }),
               total: Number(total[0].count),
               totalPages
          }
     }

     async getTransactionsByDateRange(startDate: string, endDate: string): Promise<IPayrollTransaction[]> {
          const connection = await this.connection;

          const rows = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .whereBetween('pp.period_start_date', [startDate, endDate])
               .select('pt.*')
               .orderBy('pp.period_start_date', 'desc');

          return rows.map((row: any) => this.parseTransactionDetails(row));
     }

     async getAllPayrollHistory(count?: number, page?: number, sortby?: string): Promise<{ data: any[], total: number, totalPages: number }> {
          const connection = await this.connection;

          const total = await connection('payroll_transactions').countDistinct('employeeid as count');
          const totalPages = count ? Math.ceil(Number(total[0].count) / count) : 1;

          const sortDirection = (sortby || 'ASC').toUpperCase() === 'DESC' ? 'desc' : 'asc';

          const query = connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .join('roles as r', 'pt.employeeid', 'r.employeeid')
               .leftJoin('branch as b', 'r.branch', 'b.branchid')
               .select(
                    'r.employeeid',
                    'r.username as employee_name',
                    'r.role as employee_role',
                    'r.email',
                    'b.name as branch_name',
                    connection.raw('MIN(pp.period_start_date) as first_payroll_date'),
                    connection.raw('COUNT(pt.id) as total_payrolls'),
                    connection.raw('COALESCE(SUM(pt.gross_salary), 0) as lifetime_gross'),
                    connection.raw('COALESCE(SUM(pt.net_salary), 0) as lifetime_net'),
                    connection.raw('COALESCE(SUM(pt.total_deductions), 0) as lifetime_deductions'),
                    connection.raw('COALESCE(SUM(pt.income_tax), 0) as lifetime_tax'),
                    connection.raw('0 as lifetime_ssnit'),
                    connection.raw('0 as lifetime_employer_ssnit'),
                    connection.raw('COALESCE(SUM(pt.total_allowances), 0) as lifetime_allowances'),
                    connection.raw('COALESCE(SUM(pt.total_bonuses), 0) as lifetime_bonuses'),
                    connection.raw('COALESCE(SUM(pt.employer_cost), 0) as lifetime_employer_cost')
               )
               .groupBy('r.employeeid', 'r.username', 'r.role', 'r.email', 'b.name')
               .orderBy('r.username', sortDirection);

          if (count !== undefined && page !== undefined) {
               const offset = (page - 1) * count;
               query.limit(count).offset(offset);
          }

          const data = await query;
          return {
               data,
               total: Number(total[0].count),
               totalPages
          };
     }

     async recalculateTransaction(id: number, updates: Partial<IPayrollTransaction>): Promise<boolean> {
          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               const transaction = await trx('payroll_transactions').where({ id }).first();
               if (!transaction || transaction.status === 'locked') {
                    return false;
               }

               // Recalculate gross salary
               const gross_salary =
                    (updates.basic_salary ?? transaction.basic_salary) +
                    (updates.hourly_earnings ?? transaction.hourly_earnings) +
                    (updates.overtime_earnings ?? transaction.overtime_earnings) +
                    (updates.commission_earnings ?? transaction.commission_earnings) +
                    (updates.total_allowances ?? transaction.total_allowances) +
                    (updates.total_bonuses ?? transaction.total_bonuses);

               // Recalculate total deductions
               const total_deductions =
                    (updates.income_tax ?? transaction.income_tax) +
                    (updates.total_other_deductions ?? transaction.total_other_deductions);

               // Recalculate net salary
               const net_salary = gross_salary - total_deductions;

               // Recalculate employer cost
               const employer_cost =
                    gross_salary;

               // Prepare updated transaction data
               const updatedTransaction = {
                    ...transaction,
                    ...updates,
                    gross_salary,
                    total_deductions,
                    net_salary,
                    employer_cost
               };

               // Validate the complete updated transaction
               payrollTransactionSchema.parse(updatedTransaction);

               await trx('payroll_transactions')
                    .where({ id })
                    .update({
                         ...updates,
                         gross_salary,
                         total_deductions,
                         net_salary,
                         employer_cost,
                         updated_at: trx.fn.now()
                    });

               return true;
          });
     }
}
