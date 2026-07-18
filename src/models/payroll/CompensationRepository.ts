import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface ICompensation {
     id?: number;
     employeeid: number;
     compensation_type: 'salary' | 'hourly' | 'commission' | 'hybrid';
     basic_salary?: number;
     salary_grade_id?: number;
     currency?: string;
     hourly_rate?: number;
     overtime_rate_multiplier?: number;
     commission_percentage?: number;
     commission_target?: number;
     payment_frequency: 'monthly' | 'bi-weekly' | 'weekly';
     payment_method: 'bank_transfer' | 'cash' | 'cheque' | 'mobile_money';
     bank_account_number?: string;
     bank_name?: string;
     bank_branch?: string;
     mobile_money_number?: string;
     effective_from: string;
     effective_to?: string;
     is_active: boolean;
     created_by?: number;
     updated_by?: number;
}

// Zod validation schema
const compensationSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     compensation_type: z.enum(['salary', 'hourly', 'commission', 'hybrid']),
     basic_salary: z.preprocess((val) => val === null ? undefined : val, z.number().positive().optional()),
     salary_grade_id: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Salary grade ID must be a positive number').optional()),
     currency: z.preprocess((val) => val === null ? undefined : val, z.string().max(3, 'Currency code cannot exceed 3 characters').optional()),
     hourly_rate: z.preprocess((val) => val === null ? undefined : val, z.number().positive().optional()),
     overtime_rate_multiplier: z.preprocess((val) => val === null ? undefined : val, z.number().min(1, 'Overtime rate multiplier must be at least 1').max(5, 'Overtime rate multiplier cannot exceed 5').optional()),
     commission_percentage: z.preprocess((val) => val === null ? undefined : val, z.number().min(0, 'Commission percentage cannot be negative').max(100, 'Commission percentage cannot exceed 100%').optional()),
     commission_target: z.preprocess((val) => val === null ? undefined : val, z.number().positive().optional()),
     payment_frequency: z.enum(['monthly', 'bi-weekly', 'weekly']),
     payment_method: z.enum(['bank_transfer', 'cash', 'cheque', 'mobile_money']),
     bank_account_number: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
     bank_name: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
     bank_branch: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
     mobile_money_number: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
     effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective from date must be in YYYY-MM-DD format'),
     effective_to: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective to date must be in YYYY-MM-DD format').optional()),
     is_active: z.boolean(),
     created_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Created by must be a positive number').optional()),
     updated_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Updated by must be a positive number').optional())
}).refine((data) => {
     if (['salary', 'hybrid'].includes(data.compensation_type)) {
          return data.basic_salary !== undefined && data.basic_salary > 0;
     }
     return true;
}, {
     message: 'Basic salary is required for salary/hybrid compensation',
     path: ['basic_salary']
}).refine((data) => {
     if (['hourly', 'hybrid'].includes(data.compensation_type)) {
          return data.hourly_rate !== undefined && data.hourly_rate > 0;
     }
     return true;
}, {
     message: 'Hourly rate is required for hourly/hybrid compensation',
     path: ['hourly_rate']
}).refine((data) => {
     if (['commission', 'hybrid'].includes(data.compensation_type)) {
          return data.commission_percentage !== undefined && data.commission_percentage >= 0 && data.commission_percentage <= 100;
     }
     return true;
}, {
     message: 'Commission percentage is required for commission/hybrid compensation',
     path: ['commission_percentage']
}).refine((data) => {
     if (data.payment_method === 'bank_transfer') {
          return data.bank_account_number && data.bank_account_number.trim() !== '' &&
               data.bank_name && data.bank_name.trim() !== '' &&
               data.bank_branch && data.bank_branch.trim() !== '';
     }
     return true;
}, {
     message: 'Bank details are required for bank transfer payment method',
     path: ['bank_account_number']
}).refine((data) => {
     if (data.payment_method === 'mobile_money') {
          return data.mobile_money_number && data.mobile_money_number.trim() !== '';
     }
     return true;
}, {
     message: 'Mobile money number is required for mobile money payment method',
     path: ['mobile_money_number']
}).refine((data) => {
     if (data.effective_to && data.effective_from) {
          const from = new Date(data.effective_from);
          const to = new Date(data.effective_to);
          return to > from;
     }
     return true;
}, {
     message: 'Effective to date must be after effective from date',
     path: ['effective_to']
});

export class CompensationRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private async deactivateOtherActiveCompensations(
          db: Knex | Knex.Transaction,
          employeeid: number,
          excludeId?: number
     ): Promise<void> {
          const query = db('payroll_employee_compensation')
               .where({ employeeid, is_active: true });

          if (excludeId) {
               query.andWhereNot({ id: excludeId });
          }

          await query.update({ is_active: false, updated_at: db.fn.now() });
     }

     private async validateSalaryWithinGrade(compensation: Partial<ICompensation>): Promise<void> {
          if (!compensation.salary_grade_id || compensation.basic_salary === undefined || compensation.basic_salary === null) {
               return;
          }

          const connection = await this.connection;
          const grade = await connection('payroll_salary_grades')
               .where({ id: compensation.salary_grade_id })
               .first();

          if (!grade) {
               throw new Error(`Salary grade ${compensation.salary_grade_id} not found`);
          }

          const basicSalary = Number(compensation.basic_salary);
          const minSalary = grade.min_salary !== null && grade.min_salary !== undefined ? Number(grade.min_salary) : undefined;
          const maxSalary = grade.max_salary !== null && grade.max_salary !== undefined ? Number(grade.max_salary) : undefined;

          if (minSalary !== undefined && basicSalary < minSalary) {
               throw new Error(`Basic salary ${basicSalary} is below grade minimum ${minSalary}`);
          }

          if (maxSalary !== undefined && basicSalary > maxSalary) {
               throw new Error(`Basic salary ${basicSalary} is above grade maximum ${maxSalary}`);
          }
     }

     async create(compensation: ICompensation): Promise<number> {
          // Validate data using Zod schema
          compensationSchema.parse(compensation);
          await this.validateSalaryWithinGrade(compensation);

          const connection = await this.connection;
          return connection.transaction(async (trx) => {
               if (compensation.is_active) {
                    await this.deactivateOtherActiveCompensations(trx, compensation.employeeid);
               }

               const [id] = await trx('payroll_employee_compensation').insert(compensation);
               return id;
          });
     }

     async getById(id: number): Promise<ICompensation | undefined> {
          const connection = await this.connection;
          return connection('payroll_employee_compensation').where({ id }).first();
     }

     async getByEmployeeId(employeeid: number): Promise<ICompensation[]> {
          const connection = await this.connection;
          return connection('payroll_employee_compensation')
               .where({ employeeid })
               .orderBy('effective_from', 'desc');
     }

     async getActiveByEmployeeId(employeeid: number): Promise<ICompensation | undefined> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_compensation')
               .where({ employeeid, is_active: true })
               .where('effective_from', '<=', today)
               .where((builder) => {
                    builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
               })
               .orderBy('effective_from', 'desc')
               .first();
     }

     async update(id: number, compensation: Partial<ICompensation>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid compensation ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Compensation record not found');
          }

          // Merge with existing data for complete validation
          const completeCompensation = { ...existing, ...compensation };

          // Validate complete data using Zod schema
          compensationSchema.parse(completeCompensation);
          await this.validateSalaryWithinGrade(completeCompensation);

          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               if (completeCompensation.is_active) {
                    await this.deactivateOtherActiveCompensations(trx, completeCompensation.employeeid, id);
               }

               const affectedRows = await trx('payroll_employee_compensation')
                    .where({ id })
                    .update({ ...compensation, updated_at: trx.fn.now() });

               return affectedRows > 0;
          });
     }

     async deactivate(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid compensation ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_compensation')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getEmployeesByCompensationType(compensationType: string): Promise<ICompensation[]> {
          const validTypes = ['salary', 'hourly', 'commission', 'hybrid'];
          if (!compensationType || typeof compensationType !== 'string' || !validTypes.includes(compensationType)) {
               throw new Error('Valid compensation type is required. Must be one of: ' + validTypes.join(', '));
          }

          const connection = await this.connection;
          return connection('payroll_employee_compensation')
               .where({ compensation_type: compensationType, is_active: true });
     }

     async getAllActive(): Promise<ICompensation[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_compensation')
               .leftJoin("roles", "payroll_employee_compensation.employeeid", "roles.employeeid")
               .select("payroll_employee_compensation.*", "roles.username as employee_name")
               .where({ is_active: true })
               .where('effective_from', '<=', today)
               .where((builder) => {
                    builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
               })
               .orderBy('employeeid')

     }

     async getAll(status?: string): Promise<ICompensation[]> {
          const connection = await this.connection;

          let query = connection('payroll_employee_compensation')
               .orderBy('employeeid')
               .orderBy('created_at', 'desc');

          if (status === 'active') {
               const today = new Date().toISOString().split('T')[0];
               query = query.where({ is_active: true })
                    .where('effective_from', '<=', today)
                    .where((builder) => {
                         builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
                    });
          } else if (status === 'inactive') {
               query = query.where({ is_active: false });
          }

          return query;
     }

     async createWithHistory(
          employeeid: number,
          newCompensation: ICompensation,
          endDate: string
     ): Promise<number> {
          if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
               throw new Error('Valid employee ID is required');
          }

          if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
               throw new Error('Valid end date is required in YYYY-MM-DD format');
          }

          // Validate new compensation data
          compensationSchema.parse(newCompensation);
          await this.validateSalaryWithinGrade(newCompensation);

          if (newCompensation.employeeid !== employeeid) {
               throw new Error('Employee ID in payload must match route employee ID');
          }

          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               // End current active compensation
               await trx('payroll_employee_compensation')
                    .where({ employeeid, is_active: true })
                    .update({ effective_to: endDate, is_active: false, updated_at: trx.fn.now() });

               if (newCompensation.is_active) {
                    await this.deactivateOtherActiveCompensations(trx, employeeid);
               }

               // Create new compensation record
               const [id] = await trx('payroll_employee_compensation').insert(newCompensation);
               return id;
          });
     }

     async getByIdWithGrade(id: number): Promise<any> {
          const connection = await this.connection;
          return connection('payroll_employee_compensation as c')
               .leftJoin('payroll_salary_grades as g', 'c.salary_grade_id', 'g.id')
               .select(
                    'c.*',
                    'g.grade_name',
                    'g.grade_level',
                    'g.role_name',
                    'g.min_salary as grade_min_salary',
                    'g.max_salary as grade_max_salary',
                    'g.description as grade_description',
                    'g.currency as grade_currency'
               )
               .where('c.id', id)
               .first();
     }

     async getActiveByEmployeeIdWithGrade(employeeid: number): Promise<any> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_compensation as c')
               .leftJoin('payroll_salary_grades as g', 'c.salary_grade_id', 'g.id')
               .select(
                    'c.*',
                    'g.grade_name',
                    'g.grade_level',
                    'g.role_name',
                    'g.min_salary as grade_min_salary',
                    'g.max_salary as grade_max_salary',
                    'g.description as grade_description',
                    'g.currency as grade_currency'
               )
               .where('c.employeeid', employeeid)
               .where('c.is_active', true)
               .where('c.effective_from', '<=', today)
               .where((builder: any) => {
                    builder.whereNull('c.effective_to').orWhere('c.effective_to', '>=', today);
               })
               .orderBy('c.effective_from', 'desc')
               .first();
     }
}
