import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface IOtherDeduction {
     id?: number;
     employeeid: number;
     deduction_definition_id?: number;
     deduction_type: string;
     deduction_name: string;
     amount: number;
     is_recurring: boolean;
     frequency: 'monthly' | 'bi-weekly' | 'weekly' | 'one-time';
     total_amount?: number;
     remaining_balance?: number;
     deduction_priority: number;
     start_date: string;
     end_date?: string;
     is_active: boolean;
     approved_by?: number;
     approved_date?: string;
     remarks?: string;
     attachments?: string;
}

const otherDeductionSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     deduction_definition_id: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Deduction definition ID must be a positive number').optional()),
     deduction_type: z.string().min(1, 'Deduction type cannot be empty').max(100, 'Deduction type cannot exceed 100 characters'),
     deduction_name: z.string().min(1, 'Deduction name cannot be empty').max(255, 'Deduction name cannot exceed 255 characters'),
     amount: z.number().positive('Amount must be greater than zero'),
     is_recurring: z.boolean(),
     frequency: z.enum(['monthly', 'bi-weekly', 'weekly', 'one-time']),
     total_amount: z.preprocess((val) => val === null ? undefined : val, z.number().positive().optional()),
     remaining_balance: z.preprocess((val) => val === null ? undefined : val, z.number().min(0, 'Remaining balance cannot be negative').optional()),
     deduction_priority: z.number().positive('Deduction priority must be greater than zero').int('Deduction priority must be a whole number'),
     start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
     end_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional()),
     is_active: z.boolean(),
     approved_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Approved by must be a positive number').optional()),
     approved_date: z.preprocess((val) => val === null ? undefined : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
     remarks: z.preprocess((val) => val === null ? undefined : val, z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional()),
     attachments: z.preprocess((val) => val === null ? undefined : val, z.string().max(500, 'Attachments path cannot exceed 500 characters').optional())
}).refine((data) => {
     if (data.end_date && data.start_date) {
          const start = new Date(data.start_date);
          const end = new Date(data.end_date);
          return end > start;
     }
     return true;
}, {
     message: 'End date must be after start date',
     path: ['end_date']
}).refine((data) => {
     if (!data.is_recurring || data.frequency === 'one-time') {
          return data.total_amount !== undefined && data.total_amount > 0;
     }
     return true;
}, {
     message: 'Total amount must be greater than zero when not recurring or one-time',
     path: ['total_amount']
});

export class OtherDeductionRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     async create(deduction: IOtherDeduction): Promise<number> {
          // Validate data using Zod schema
          otherDeductionSchema.parse(deduction);

          const connection = await this.connection;
          const [id] = await connection('payroll_employee_other_deductions').insert(deduction);
          return id;
     }

     async getById(id: number): Promise<IOtherDeduction | undefined> {
          const connection = await this.connection;
          return connection('payroll_employee_other_deductions').where({ id }).first();
     }

     async getByEmployeeId(employeeid: number): Promise<IOtherDeduction[]> {
          const connection = await this.connection;
          return connection('payroll_employee_other_deductions')
               .where({ employeeid })
               .orderBy('deduction_priority', 'asc');
     }

     async getActiveByEmployeeId(employeeid: number): Promise<IOtherDeduction[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_other_deductions')
               .where({ employeeid, is_active: true })
               .where('start_date', '<=', today)
               .where((builder) => {
                    builder.whereNull('end_date').orWhere('end_date', '>=', today);
               })
               .orderBy('deduction_priority', 'asc');
     }

     async getRecurringByEmployeeId(employeeid: number): Promise<IOtherDeduction[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_other_deductions')
               .where({ employeeid, is_active: true, is_recurring: true })
               .where('start_date', '<=', today)
               .where((builder) => {
                    builder.whereNull('end_date').orWhere('end_date', '>=', today);
               })
               .orderBy('deduction_priority', 'asc');
     }

     async update(id: number, deduction: Partial<IOtherDeduction>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid deduction ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Other deduction record not found');
          }

          // Merge with existing data for complete validation
          const completeDeduction = { ...existing, ...deduction };

          // Validate complete data using Zod schema
          otherDeductionSchema.parse(completeDeduction);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_other_deductions')
               .where({ id })
               .update({ ...deduction, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async deactivate(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid deduction ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_other_deductions')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async updateRemainingBalance(id: number, payment_amount: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid deduction ID is required');
          }

          if (!payment_amount || typeof payment_amount !== 'number' || payment_amount <= 0) {
               throw new Error('Payment amount must be a positive number');
          }

          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               const deduction = await trx('payroll_employee_other_deductions').where({ id }).first();
               if (!deduction) return false;

               const newBalance = (deduction.remaining_balance || 0) - payment_amount;

               const updateData: any = {
                    remaining_balance: newBalance,
                    updated_at: trx.fn.now()
               };

               // If balance is paid off, mark as inactive
               if (newBalance <= 0) {
                    updateData.is_active = false;
                    updateData.remaining_balance = 0;
               }

               await trx('payroll_employee_other_deductions')
                    .where({ id })
                    .update(updateData);

               return true;
          });
     }

     async getTotalDeductionsByEmployee(
          employeeid: number,
          frequency: string = 'monthly'
     ): Promise<number> {
          if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
               throw new Error('Valid employee ID is required');
          }

          const validFrequencies = ['monthly', 'bi-weekly', 'weekly', 'one-time'];
          if (!validFrequencies.includes(frequency)) {
               throw new Error('Invalid frequency. Must be one of: ' + validFrequencies.join(', '));
          }

          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          const result = await connection('payroll_employee_other_deductions')
               .where({ employeeid, is_active: true, frequency })
               .where('start_date', '<=', today)
               .where((builder) => {
                    builder.whereNull('end_date').orWhere('end_date', '>=', today);
               })
               .sum('amount as total')
               .first();

          return result?.total || 0;
     }

     async getByDeductionType(deduction_type: string): Promise<IOtherDeduction[]> {
          const validTypes = ['loan', 'advance', 'garnishment', 'union_dues', 'insurance', 'cooperative', 'welfare', 'savings', 'disciplinary', 'other'];
          if (!deduction_type || typeof deduction_type !== 'string' || !validTypes.includes(deduction_type)) {
               throw new Error('Valid deduction type is required. Must be one of: ' + validTypes.join(', '));
          }

          const connection = await this.connection;
          return connection('payroll_employee_other_deductions')
               .where({ deduction_type, is_active: true });
     }

     async getAllActive(): Promise<IOtherDeduction[]> {
          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection('payroll_employee_other_deductions')
               .where({ is_active: true })
               .where('start_date', '<=', today)
               .where((builder) => {
                    builder.whereNull('end_date').orWhere('end_date', '>=', today);
               })
               .orderBy(['employeeid', 'deduction_priority']);
     }

     async getAll(activeOnly: boolean = true): Promise<IOtherDeduction[]> {
          const connection = await this.connection;

          const query = connection('payroll_employee_other_deductions')
               .orderBy('employeeid', 'asc')
               .orderBy('deduction_priority', 'asc');

          if (activeOnly) {
               query.where({ is_active: true });
          }

          return query;
     }

     async getPendingApprovals(): Promise<IOtherDeduction[]> {
          const connection = await this.connection;
          return connection('payroll_employee_other_deductions')
               .whereNull('approved_by')
               .orderBy('created_at', 'asc');
     }

     async approve(id: number, approved_by: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid deduction ID is required');
          }

          if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
               throw new Error('Valid approver ID is required');
          }

          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          const affectedRows = await connection('payroll_employee_other_deductions')
               .where({ id })
               .update({
                    approved_by,
                    approved_date: today,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }
}
