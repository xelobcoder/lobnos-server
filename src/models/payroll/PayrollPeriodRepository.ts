import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface IPayrollPeriod {
     id?: number;
     period_name: string;
     period_year: number;
     period_month: number;
     period_start_date: string;
     period_end_date: string;
     payment_date: string;
     attendance_start_date: string;
     attendance_end_date: string;
     status: 'draft' | 'calculated' | 'approved' | 'locked' | 'paid';
     total_gross_salary: number;
     total_deductions: number;
     total_net_salary: number;
     employee_count: number;
     tax_configuration_id?: number;
     calculated_by?: number;
     calculated_at?: string;
     approved_by?: number;
     approved_at?: string;
     locked_by?: number;
     locked_at?: string;
}

export interface ICreatePayrollPeriodInput {
     period_name?: string;
     period_start_date: string;
     period_end_date: string;
     payment_date?: string;
     attendance_start_date?: string;
     attendance_end_date?: string;
}

// Zod validation schema
const payrollPeriodSchema = z.object({
     period_name: z.string().min(1, 'Period name cannot be empty').max(100, 'Period name cannot exceed 100 characters'),
     period_year: z.number().min(2000, 'Period year must be 2000 or later').max(2100, 'Period year cannot exceed 2100'),
     period_month: z.number().min(1, 'Period month must be between 1 and 12').max(12, 'Period month must be between 1 and 12'),
     period_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period start date must be in YYYY-MM-DD format'),
     period_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period end date must be in YYYY-MM-DD format'),
     payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format'),
     attendance_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Attendance start date must be in YYYY-MM-DD format'),
     attendance_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Attendance end date must be in YYYY-MM-DD format'),
     status: z.enum(['draft', 'calculated', 'approved', 'locked', 'paid']),
     total_gross_salary: z.number().min(0, 'Total gross salary cannot be negative'),
     total_deductions: z.number().min(0, 'Total deductions cannot be negative'),
     total_net_salary: z.number().min(0, 'Total net salary cannot be negative'),
     employee_count: z.number().min(0, 'Employee count cannot be negative').int('Employee count must be a whole number'),
     tax_configuration_id: z.number().positive('Tax configuration ID must be a positive number').optional(),
     calculated_by: z.number().positive('Calculated by must be a positive number').optional(),
     calculated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Calculated at must be a valid datetime').optional(),
     approved_by: z.number().positive('Approved by must be a positive number').optional(),
     approved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Approved at must be a valid datetime').optional(),
     locked_by: z.number().positive('Locked by must be a positive number').optional(),
     locked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Locked at must be a valid datetime').optional()
}).refine((data) => {
     const start = new Date(data.period_start_date);
     const end = new Date(data.period_end_date);
     return end > start;
}, {
     message: 'Period end date must be after period start date',
     path: ['period_end_date']
}).refine((data) => {
     const start = new Date(data.attendance_start_date);
     const end = new Date(data.attendance_end_date);
     return end > start;
}, {
     message: 'Attendance end date must be after attendance start date',
     path: ['attendance_end_date']
}).refine((data) => {
     if (['calculated', 'approved', 'locked', 'paid'].includes(data.status) && (!data.calculated_by || data.calculated_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Calculated by is required for calculated/approved/locked/paid periods',
     path: ['calculated_by']
}).refine((data) => {
     if (['calculated', 'approved', 'locked', 'paid'].includes(data.status) && (!data.calculated_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.calculated_at))) {
          return false;
     }
     return true;
}, {
     message: 'Calculated at is required for calculated/approved/locked/paid periods',
     path: ['calculated_at']
}).refine((data) => {
     if (['approved', 'locked', 'paid'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Approved by is required for approved/locked/paid periods',
     path: ['approved_by']
}).refine((data) => {
     if (['approved', 'locked', 'paid'].includes(data.status) && (!data.approved_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.approved_at))) {
          return false;
     }
     return true;
}, {
     message: 'Approved at is required for approved/locked/paid periods',
     path: ['approved_at']
}).refine((data) => {
     if (['locked', 'paid'].includes(data.status) && (!data.locked_by || data.locked_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Locked by is required for locked/paid periods',
     path: ['locked_by']
}).refine((data) => {
     if (['locked', 'paid'].includes(data.status) && (!data.locked_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.locked_at))) {
          return false;
     }
     return true;
}, {
     message: 'Locked at is required for locked/paid periods',
     path: ['locked_at']
});

export class PayrollPeriodRepository {
     constructor(private tenantId: number, private trx?: Knex.Transaction) { }

     private get connection(): Promise<Knex> {
          return this.trx ? Promise.resolve(this.trx) : KnexConnection(this.tenantId);
     }

     private parsePeriodDetails(period: any): IPayrollPeriod {
          return {
               id: period.id ? Number(period.id) : undefined,
               period_name: String(period.period_name),
               period_year: Number(period.period_year),
               period_month: Number(period.period_month),
               period_start_date: period.period_start_date instanceof Date ?
                    period.period_start_date.toISOString().split('T')[0] :
                    String(period.period_start_date),
               period_end_date: period.period_end_date instanceof Date ?
                    period.period_end_date.toISOString().split('T')[0] :
                    String(period.period_end_date),
               payment_date: period.payment_date instanceof Date ?
                    period.payment_date.toISOString().split('T')[0] :
                    String(period.payment_date),
               attendance_start_date: period.attendance_start_date instanceof Date ?
                    period.attendance_start_date.toISOString().split('T')[0] :
                    String(period.attendance_start_date),
               attendance_end_date: period.attendance_end_date instanceof Date ?
                    period.attendance_end_date.toISOString().split('T')[0] :
                    String(period.attendance_end_date),
               status: period.status,
               total_gross_salary: Number(period.total_gross_salary) || 0,
               total_deductions: Number(period.total_deductions) || 0,
               total_net_salary: Number(period.total_net_salary) || 0,
               employee_count: Number(period.employee_count) || 0,
               tax_configuration_id: period.tax_configuration_id ? Number(period.tax_configuration_id) : undefined,
               calculated_by: period.calculated_by ? Number(period.calculated_by) : undefined,
               calculated_at: period.calculated_at ?
                    (period.calculated_at instanceof Date ?
                         period.calculated_at.toISOString().slice(0, 19) :
                         String(period.calculated_at)) :
                    undefined,
               approved_by: period.approved_by ? Number(period.approved_by) : undefined,
               approved_at: period.approved_at ?
                    (period.approved_at instanceof Date ?
                         period.approved_at.toISOString().slice(0, 19) :
                         String(period.approved_at)) :
                    undefined,
               locked_by: period.locked_by ? Number(period.locked_by) : undefined,
               locked_at: period.locked_at ?
                    (period.locked_at instanceof Date ?
                         period.locked_at.toISOString().slice(0, 19) :
                         String(period.locked_at)) :
                    undefined
          };
     }

     private async assertNoDuplicateOrOverlap(period: IPayrollPeriod, excludeId?: number): Promise<void> {
          const connection = await this.connection;

          const duplicateQuery = connection('payroll_periods')
               .where({ period_year: period.period_year, period_month: period.period_month });

          if (excludeId) {
               duplicateQuery.andWhereNot({ id: excludeId });
          }

          const duplicate = await duplicateQuery.first();
          if (duplicate) {
               throw new Error(`Payroll period ${period.period_month}/${period.period_year} already exists`);
          }

          const overlapQuery = connection('payroll_periods')
               .where('period_start_date', '<=', period.period_end_date)
               .andWhere('period_end_date', '>=', period.period_start_date);

          if (excludeId) {
               overlapQuery.andWhereNot({ id: excludeId });
          }

          const overlappingPeriod = await overlapQuery.first();
          if (overlappingPeriod) {
               throw new Error('Payroll period overlaps with an existing period');
          }
     }

     async create(period: IPayrollPeriod): Promise<number> {
          // Validate data using Zod schema
          payrollPeriodSchema.parse(period);
          await this.assertNoDuplicateOrOverlap(period);

          const connection = await this.connection;
          const [id] = await connection('payroll_periods').insert(period);
          return id;
     }

     async createCustomPeriod(input: ICreatePayrollPeriodInput): Promise<number> {
          const startDate = new Date(input.period_start_date);
          const endDate = new Date(input.period_end_date);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
               throw new Error('Invalid period start or end date');
          }

          const year = startDate.getFullYear();
          const month = startDate.getMonth() + 1;
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December'];

          const period: IPayrollPeriod = {
               period_name: input.period_name?.trim() || `${monthNames[month - 1]} ${year}`,
               period_year: year,
               period_month: month,
               period_start_date: input.period_start_date,
               period_end_date: input.period_end_date,
               payment_date: input.payment_date || input.period_end_date,
               attendance_start_date: input.attendance_start_date || input.period_start_date,
               attendance_end_date: input.attendance_end_date || input.period_end_date,
               status: 'draft',
               total_gross_salary: 0,
               total_deductions: 0,
               total_net_salary: 0,
               employee_count: 0
          };

          return this.create(period);
     }

     async getById(id: number): Promise<IPayrollPeriod | undefined> {
          const connection = await this.connection;
          const period = await connection('payroll_periods').where({ id }).first();
          return period ? this.parsePeriodDetails(period) : undefined;
     }

     async getByYearAndMonth(year: number, month: number): Promise<IPayrollPeriod | undefined> {
          const connection = await this.connection;
          const period = await connection('payroll_periods')
               .where({ period_year: year, period_month: month })
               .first();
          return period ? this.parsePeriodDetails(period) : undefined;
     }

     async getByYear(year: number): Promise<IPayrollPeriod[]> {
          const connection = await this.connection;
          const periods = await connection('payroll_periods')
               .where({ period_year: year })
               .orderBy('period_month', 'asc');
          return periods.map(p => this.parsePeriodDetails(p));
     }

     async getByStatus(status: string): Promise<IPayrollPeriod[]> {
          const connection = await this.connection;
          const periods = await connection('payroll_periods')
               .where({ status })
               .orderBy([{ column: 'period_year', order: 'desc' }, { column: 'period_month', order: 'desc' }]);
          return periods.map(p => this.parsePeriodDetails(p));
     }

     async getAll(): Promise<IPayrollPeriod[]> {
          const connection = await this.connection;
          const periods = await connection('payroll_periods')
               .orderBy([{ column: 'period_year', order: 'desc' }, { column: 'period_month', order: 'desc' }]);
          return periods.map(p => this.parsePeriodDetails(p));
     }

     async update(id: number, period: Partial<IPayrollPeriod>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid payroll period ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Payroll period record not found');
          }

          // Merge with existing data for complete validation
          const completePeriod = { ...existing, ...period };

          // Validate complete data using Zod schema
          payrollPeriodSchema.parse(completePeriod);
          await this.assertNoDuplicateOrOverlap(completePeriod, id);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({ ...period, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async updateStatus(id: number, status: string): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid payroll period ID is required');
          }

          const validStatuses = ['draft', 'calculated', 'approved', 'locked', 'paid'];
          if (!status || typeof status !== 'string' || !validStatuses.includes(status)) {
               throw new Error('Valid status is required. Must be one of: ' + validStatuses.join(', '));
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({ status, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async revertWorkflowStatus(
          id: number,
          status: 'draft' | 'calculated' | 'approved'
     ): Promise<boolean> {
          const connection = await this.connection;

          const updates: Record<string, any> = {
               status,
               updated_at: connection.fn.now()
          };

          if (status === 'draft') {
               updates.approved_by = null;
               updates.approved_at = null;
               updates.locked_by = null;
               updates.locked_at = null;
          }

          if (status === 'calculated') {
               updates.approved_by = null;
               updates.approved_at = null;
               updates.locked_by = null;
               updates.locked_at = null;
          }

          if (status === 'approved') {
               updates.locked_by = null;
               updates.locked_at = null;
          }

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update(updates);

          return affectedRows > 0;
     }

     async markAsCalculated(id: number, calculated_by: number): Promise<boolean> {
          const connection = await this.connection;
          const now = new Date().toISOString();

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({
                    status: 'calculated',
                    calculated_by,
                    calculated_at: new Date(),
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async markAsApproved(id: number, approved_by: number): Promise<boolean> {
          const connection = await this.connection;

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({
                    status: 'approved',
                    approved_by,
                    approved_at: new Date(),
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async markAsLocked(id: number, locked_by: number): Promise<boolean> {
          const connection = await this.connection;

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({
                    status: 'locked',
                    locked_by,
                    locked_at: new Date(),
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async markAsPaid(id: number): Promise<boolean> {
          const connection = await this.connection;

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({
                    status: 'paid',
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async updateTotals(
          id: number,
          total_gross_salary: number,
          total_deductions: number,
          total_net_salary: number,
          employee_count: number
     ): Promise<boolean> {
          const connection = await this.connection;

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .update({
                    total_gross_salary,
                    total_deductions,
                    total_net_salary,
                    employee_count,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async delete(id: number): Promise<boolean> {
          const connection = await this.connection;

          // Only allow deletion of draft periods
          const period = await this.getById(id);
          if (!period || period.status !== 'draft') {
               return false;
          }

          const periodTransactions = await connection('payroll_transactions')
               .where({ payroll_period_id: id })
               .count<{ total: number }[]>({ total: '*' });

          const transactionCount = Number((periodTransactions as any)?.[0]?.total || 0);
          if (transactionCount > 0) {
               return false;
          }

          const affectedRows = await connection('payroll_periods')
               .where({ id })
               .delete();

          return affectedRows > 0;
     }

     async getCurrentPeriod(): Promise<IPayrollPeriod | undefined> {
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;

          return this.getByYearAndMonth(currentYear, currentMonth);
     }

     async getLatestPeriod(): Promise<IPayrollPeriod | undefined> {
          const connection = await this.connection;
          return connection('payroll_periods')
               .orderBy([{ column: 'period_year', order: 'desc' }, { column: 'period_month', order: 'desc' }])
               .first();
     }

     async createNextPeriod(): Promise<number> {
          const latest = await this.getLatestPeriod();

          let year: number, month: number;

          if (!latest) {
               const now = new Date();
               year = now.getFullYear();
               month = now.getMonth() + 1;
          } else {
               year = latest.period_year;
               month = latest.period_month + 1;

               if (month > 12) {
                    month = 1;
                    year += 1;
               }
          }

          // Calculate dates
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          const paymentDate = new Date(year, month, 5);

          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December'];

          return this.create({
               period_name: `${monthNames[month - 1]} ${year}`,
               period_year: year,
               period_month: month,
               period_start_date: startDate.toISOString().split('T')[0],
               period_end_date: endDate.toISOString().split('T')[0],
               payment_date: paymentDate.toISOString().split('T')[0],
               attendance_start_date: startDate.toISOString().split('T')[0],
               attendance_end_date: endDate.toISOString().split('T')[0],
               status: 'draft',
               total_gross_salary: 0,
               total_deductions: 0,
               total_net_salary: 0,
               employee_count: 0
          });
     }
}
