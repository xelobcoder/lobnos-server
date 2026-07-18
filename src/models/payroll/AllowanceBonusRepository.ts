import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface IAllowance {
     id?: number;
     employeeid: number;
     allowance_type: 'housing' | 'transport' | 'meal' | 'medical' | 'education' |
     'uniform' | 'mobile' | 'hazard' | 'shift_allowance' | 'professional_development' |
     'internet' | 'utility' | 'fuel' | 'risk' | 'hardship' | 'acting' | 'responsibility' | 'entertainment' | 'other';
     amount: number;
     calculation_method: 'fixed' | 'percentage_of_basic' | 'variable';
     percentage?: number;
     is_recurring: boolean;
     frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
     is_taxable: boolean;
     effective_from: string;
     effective_to?: string;
     is_active: boolean;
     approved_by?: number;
}

export interface IBonus {
     id?: number;
     employeeid: number;
     bonus_type: 'performance' | 'annual' | 'project' | 'retention' | 'holiday' | 'spot';
     amount: number;
     start_date: string;
     end_date: string;
     bonus_period?: string;
     is_taxable: boolean;
     tax_method: 'aggregate' | 'separate' | 'bonus_rate';
     status: 'pending' | 'approved' | 'rejected' | 'paid';
     approved_by?: number;
     approved_date?: string;
     reason?: string;
     performance_rating?: number;
     payment_date?: string;
}

// Zod validation schemas
const allowanceSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     allowance_type: z.enum([
          'housing',
          'transport',
          'meal',
          'medical',
          'education',
          'uniform',
          'mobile',
          'hazard',
          'shift_allowance',
          'professional_development',
          'internet',
          'utility',
          'fuel',
          'risk',
          'hardship',
          'acting',
          'responsibility',
          'entertainment',
          'other'
     ]),
     amount: z.number().positive('Amount must be greater than zero'),
     calculation_method: z.enum(['fixed', 'percentage_of_basic', 'variable']),
     percentage: z.preprocess((val) => val === null ? undefined : val, z.number().min(0, 'Percentage cannot be negative').max(100, 'Percentage cannot exceed 100%').optional()),
     is_recurring: z.boolean(),
     frequency: z.enum(['monthly', 'quarterly', 'annually', 'one-time']),
     is_taxable: z.boolean(),
     effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective from date must be in YYYY-MM-DD format'),
     effective_to: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective to date must be in YYYY-MM-DD format').optional()),
     is_active: z.boolean(),
     approved_by: z.number().positive('Approved by must be a positive number').optional()
}).refine((data) => {
     if (data.calculation_method === 'percentage_of_basic' && (data.percentage === undefined || data.percentage < 0 || data.percentage > 100)) {
          return false;
     }
     return true;
}, {
     message: 'Percentage is required for percentage-based calculation',
     path: ['percentage']
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

const bonusSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     bonus_type: z.enum(['performance', 'annual', 'project', 'retention', 'holiday', 'spot']),
     amount: z.number().positive('Amount must be greater than zero'),
     start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').nonempty('Start date is required'),
     end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').nonempty('End date is required'),
     is_taxable: z.boolean(),
     tax_method: z.enum(['aggregate', 'separate', 'bonus_rate']),
     status: z.enum(['pending', 'approved', 'rejected', 'paid']),
     approved_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Approved by must be a positive number').optional()),
     approved_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
     reason: z.preprocess((val) => val === null ? undefined : val, z.string().max(500, 'Reason cannot exceed 500 characters').optional()),
     performance_rating: z.preprocess((val) => val === null ? undefined : val, z.number().min(1, 'Performance rating must be at least 1').max(5, 'Performance rating cannot exceed 5').optional()),
     payment_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format').optional()),
     bonus_period: z.preprocess((val) => val === null ? undefined : val, z.string().max(50, 'Bonus period cannot exceed 50 characters').optional())
}).refine((data) => {
     if (['approved', 'rejected', 'paid'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Approved by is required for approved/rejected/paid bonuses',
     path: ['approved_by']
}).refine((data) => {
     if (['approved', 'rejected', 'paid'].includes(data.status) && (!data.approved_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.approved_date))) {
          return false;
     }
     return true;
}, {
     message: 'Approved date is required for approved/rejected/paid bonuses',
     path: ['approved_date']
});



const bonusUpdateSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number').optional(),
     bonus_type: z.enum(['performance', 'annual', 'project', 'retention', 'holiday', 'spot']).optional(),
     amount: z.number().positive('Amount must be greater than zero').optional(),
     start_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional()),
     end_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional()),
     is_taxable: z.boolean().optional(),
     tax_method: z.enum(['aggregate', 'separate', 'bonus_rate']).optional(),
     status: z.enum(['pending', 'approved', 'rejected', 'paid']),
     approved_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Approved by must be a positive number').optional()),
     approved_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
     reason: z.preprocess((val) => val === null ? undefined : val, z.string().max(500, 'Reason cannot exceed 500 characters').optional()),
     performance_rating: z.preprocess((val) => val === null ? undefined : val, z.number().min(1, 'Performance rating must be at least 1').max(5, 'Performance rating cannot exceed 5').optional()),
     payment_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format').optional()),
     bonus_period: z.preprocess((val) => val === null ? undefined : val, z.string().max(50, 'Bonus period cannot exceed 50 characters').optional())
}).refine((data) => {
     if (['approved', 'rejected', 'paid'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Approved by is required for approved/rejected/paid bonuses',
     path: ['approved_by']
})


export class AllowanceRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private normalizeDateInput(value: string): string {
          if (!value) {
               return value;
          }

          const normalized = String(value);
          return normalized.includes('T') ? normalized.split('T')[0] : normalized;
     }

     async create(allowance: IAllowance): Promise<number> {
          // Validate data using Zod schema
          allowanceSchema.parse(allowance);

          const connection = await this.connection;
          const [id] = await connection('payroll_employee_allowances').insert(allowance);
          return id;
     }

     async getById(id: number): Promise<IAllowance | undefined> {
          const connection = await this.connection;
          return connection('payroll_employee_allowances').where({ id }).first();
     }

     async getByEmployeeId(employeeid: number): Promise<IAllowance[]> {
          const connection = await this.connection;
          return connection('payroll_employee_allowances')
               .where({ employeeid })
               .orderBy('effective_from', 'desc');
     }

     async getActiveByEmployeeId(employeeid: number): Promise<IAllowance[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_allowances')
               .where({ employeeid, is_active: true })
               .where('effective_from', '<=', today)
               .where((builder) => {
                    builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
               })
               .orderBy('allowance_type');
     }

     async getApplicableByEmployeeId(
          employeeid: number,
          periodStartDate: string,
          periodEndDate: string
     ): Promise<IAllowance[]> {
          const connection = await this.connection;
          const normalizedStart = this.normalizeDateInput(periodStartDate);
          const normalizedEnd = this.normalizeDateInput(periodEndDate);

          return connection('payroll_employee_allowances')
               .where({ employeeid, is_active: true })
               .whereRaw('DATE(effective_from) <= DATE(?)', [normalizedEnd])
               .where((builder) => {
                    builder.whereNull('effective_to').orWhereRaw('DATE(effective_to) >= DATE(?)', [normalizedStart]);
               })
               .orderBy('allowance_type');
     }

     async getRecurringByEmployeeId(employeeid: number): Promise<IAllowance[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_allowances')
               .where({ employeeid, is_active: true, is_recurring: true })
               .where('effective_from', '<=', today)
               .where((builder) => {
                    builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
               });
     }

     async update(id: number, allowance: Partial<IAllowance>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid allowance ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Allowance record not found');
          }

          // Merge with existing data for complete validation
          const completeAllowance = { ...existing, ...allowance };

          // Validate complete data using Zod schema
          allowanceSchema.parse(completeAllowance);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_allowances')
               .where({ id })
               .update({ ...allowance, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async deactivate(id: number): Promise<boolean> {
          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_allowances')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getTotalAllowancesByEmployee(
          employeeid: number,
          frequency: string = 'monthly'
     ): Promise<number> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          const result = await connection('payroll_employee_allowances')
               .where({ employeeid, is_active: true, frequency })
               .where('effective_from', '<=', today)
               .where((builder) => {
                    builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
               })
               .sum('amount as total')
               .first();

          return result?.total || 0;
     }

     async getAllActive(): Promise<IAllowance[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_allowances')
               .where({ is_active: true })
               .where('effective_from', '<=', today)
               .where((builder) => {
                    builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
               });
     }
}

export class BonusRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     async create(bonus: IBonus): Promise<number> {
          bonusSchema.parse(bonus);
          const connection = await this.connection;
          const [id] = await connection('payroll_employee_bonuses').insert(bonus);
          return id;
     }

     async getById(id: number): Promise<IBonus | undefined> {
          const connection = await this.connection;
          return connection('payroll_employee_bonuses').where({ id }).first();
     }

     async getByEmployeeId(employeeid: number): Promise<IBonus[]> {
          const connection = await this.connection;
          return connection('payroll_employee_bonuses')
               .where({ employeeid })
               .orderBy('created_at', 'desc');
     }

     async getByStatus(status: string): Promise<IBonus[]> {
          const connection = await this.connection;
          return connection('payroll_employee_bonuses')
               .where({ status })
               .orderBy('created_at', 'desc');
     }

     async getPendingApprovals(): Promise<IBonus[]> {
          const connection = await this.connection;
          return connection('payroll_employee_bonuses')
               .where({ status: 'pending' })
               .orderBy('created_at', 'asc');
     }

     async update(id: number, bonus: Partial<IBonus>): Promise<boolean> {
          try {
               if (!id || typeof id !== 'number' || id <= 0) {
                    throw new Error('Valid bonus ID is required for update');
               }
               const existing = await this.getById(id);
               if (!existing) throw new Error('Bonus record not found');

               const completeBonus = { ...existing, ...bonus };

               bonusUpdateSchema.parse(completeBonus);

               const connection = await this.connection;
               const affectedRows = await connection('payroll_employee_bonuses')
                    .where({ id })
                    .update({ ...bonus, updated_at: connection.fn.now() });
               return affectedRows > 0;
          } catch (err) {
               console.error('Error updating bonus:', err);
               throw err;
          }
     }

     async delete(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid bonus ID is required for delete');
          }

          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Bonus record not found');
          }

          if (existing.status === 'paid') {
               throw new Error('Paid bonuses cannot be deleted');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_bonuses')
               .where({ id })
               .del();
          return affectedRows > 0;
     }

     async approve(id: number, approved_by: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid bonus ID is required');
          }

          if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
               throw new Error('Valid approver ID is required');
          }

          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          const affectedRows = await connection('payroll_employee_bonuses')
               .where({ id })
               .update({
                    status: 'approved',
                    approved_by,
                    approved_date: today,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async reject(id: number, approved_by: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid bonus ID is required');
          }

          if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
               throw new Error('Valid approver ID is required');
          }

          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          const affectedRows = await connection('payroll_employee_bonuses')
               .where({ id })
               .update({
                    status: 'rejected',
                    approved_by,
                    approved_date: today,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async markAsPaid(id: number, payment_date: string): Promise<boolean> {
          const connection = await this.connection;

          const affectedRows = await connection('payroll_employee_bonuses')
               .where({ id })
               .update({
                    status: 'paid',
                    payment_date,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async getApprovedForDateRange(
          employeeid: number,
          startDate: string,
          endDate: string
     ): Promise<IBonus[]> {
          const connection = await this.connection;
          return connection('payroll_employee_bonuses')
               .where({ employeeid, status: 'approved' })
               .whereNull('payment_date')
               .where((builder) => {
                    builder
                         .whereBetween('start_date', [startDate, endDate])
                         .orWhereBetween('end_date', [startDate, endDate])
                         .orWhere((qb) => {
                              qb.where('start_date', '<=', startDate)
                                   .where('end_date', '>=', endDate);
                         });
               })
               .orderBy('start_date', 'asc');
     }

     async getTotalBonusesByEmployee(
          employeeid: number,
          startDate: string,
          endDate: string
     ): Promise<number> {
          const connection = await this.connection;

          const result = await connection('payroll_employee_bonuses')
               .where({ employeeid, status: 'paid' })
               .whereBetween('payment_date', [startDate, endDate])
               .sum('amount as total')
               .first();

          return result?.total || 0;
     }

}
