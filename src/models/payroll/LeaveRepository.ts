import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface ILeave {
     id?: number;
     employeeid: number;
     leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'study' | 'compassionate';
     start_date: string;
     end_date: string;
     total_days: number;
     status: 'pending' | 'approved' | 'rejected' | 'cancelled';
     applied_date: string;
     approved_by?: number;
     approved_date?: string;
     affects_salary: boolean;
     reason?: string;
     attachments?: string;
}

export interface ILeaveBalance {
     id?: number;
     employeeid: number;
     leave_year: number;
     annual_leave_entitlement: number;
     sick_leave_entitlement: number;
     annual_leave_taken: number;
     annual_leave_balance: number;
     sick_leave_taken: number;
     sick_leave_balance: number;
}

// Zod validation schemas
const leaveSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     leave_type: z.enum(['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'study', 'compassionate']),
     start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
     end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
     total_days: z.number().positive('Total days must be greater than zero'),
     status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
     applied_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Applied date must be in YYYY-MM-DD format'),
     approved_by: z.number().positive('Approved by must be a positive number').optional(),
     approved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional(),
     affects_salary: z.boolean(),
     reason: z.string().max(1000, 'Reason cannot exceed 1000 characters').optional(),
     attachments: z.string().max(500, 'Attachments path cannot exceed 500 characters').optional()
}).refine((data) => {
     const start = new Date(data.start_date);
     const end = new Date(data.end_date);
     return end >= start;
}, {
     message: 'End date must be after or equal to start date',
     path: ['end_date']
}).refine((data) => {
     if (['approved', 'rejected'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Approved by is required for approved/rejected leave',
     path: ['approved_by']
}).refine((data) => {
     if (['approved', 'rejected'].includes(data.status) && (!data.approved_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.approved_date))) {
          return false;
     }
     return true;
}, {
     message: 'Approved date is required for approved/rejected leave',
     path: ['approved_date']
});

const leaveBalanceSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     leave_year: z.number().min(2000, 'Leave year must be 2000 or later').max(2100, 'Leave year cannot exceed 2100'),
     annual_leave_entitlement: z.number().min(0, 'Annual leave entitlement cannot be negative'),
     sick_leave_entitlement: z.number().min(0, 'Sick leave entitlement cannot be negative'),
     annual_leave_taken: z.number().min(0, 'Annual leave taken cannot be negative'),
     annual_leave_balance: z.number(),
     sick_leave_taken: z.number().min(0, 'Sick leave taken cannot be negative'),
     sick_leave_balance: z.number()
});

export class LeaveRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     // Leave CRUD Operations
     async createLeave(leave: ILeave): Promise<number> {
          // Validate data using Zod schema
          leaveSchema.parse(leave);

          const connection = await this.connection;
          const [id] = await connection('payroll_employee_leave').insert(leave);
          return id;
     }

     async getLeaveById(id: number): Promise<ILeave | undefined> {
          const connection = await this.connection;
          return connection('payroll_employee_leave').where({ id }).first();
     }

     async getLeavesByEmployeeId(employeeid: number): Promise<ILeave[]> {
          const connection = await this.connection;
          return connection('payroll_employee_leave')
               .where({ employeeid })
               .orderBy('applied_date', 'desc');
     }

     async getLeavesByStatus(status: string): Promise<ILeave[]> {
          const connection = await this.connection;
          return connection('payroll_employee_leave')
               .where({ status })
               .orderBy('applied_date', 'desc');
     }

     async getLeavesByDateRange(startDate: string, endDate: string): Promise<ILeave[]> {
          const connection = await this.connection;
          return connection('payroll_employee_leave')
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

     async updateLeave(id: number, leave: Partial<ILeave>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid leave ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getLeaveById(id);
          if (!existing) {
               throw new Error('Leave record not found');
          }

          // Merge with existing data for complete validation
          const completeLeave = { ...existing, ...leave };

          // Validate complete data using Zod schema
          leaveSchema.parse(completeLeave);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_leave')
               .where({ id })
               .update({ ...leave, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async approveLeave(id: number, approved_by: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid leave ID is required');
          }

          if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
               throw new Error('Valid approver ID is required');
          }

          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          return connection.transaction(async (trx) => {
               const leave = await trx('payroll_employee_leave').where({ id }).first();
               if (!leave) return false;

               // Update leave status
               await trx('payroll_employee_leave')
                    .where({ id })
                    .update({
                         status: 'approved',
                         approved_by,
                         approved_date: today,
                         updated_at: trx.fn.now()
                    });

               // Update leave balance
               if (leave.leave_type === 'annual' || leave.leave_type === 'sick') {
                    const balance = await this.getLeaveBalance(leave.employeeid, new Date().getFullYear(), trx);

                    if (balance) {
                         if (leave.leave_type === 'annual') {
                              await trx('payroll_employee_leave_balance')
                                   .where({ id: balance.id })
                                   .update({
                                        annual_leave_taken: balance.annual_leave_taken + leave.total_days,
                                        annual_leave_balance: balance.annual_leave_balance - leave.total_days,
                                        updated_at: trx.fn.now()
                                   });
                         } else if (leave.leave_type === 'sick') {
                              await trx('payroll_employee_leave_balance')
                                   .where({ id: balance.id })
                                   .update({
                                        sick_leave_taken: balance.sick_leave_taken + leave.total_days,
                                        sick_leave_balance: balance.sick_leave_balance - leave.total_days,
                                        updated_at: trx.fn.now()
                                   });
                         }
                    }
               }

               return true;
          });
     }

     async rejectLeave(id: number, approved_by: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid leave ID is required');
          }

          if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
               throw new Error('Valid approver ID is required');
          }

          const connection = await this.connection;
          const today = new Date().toISOString().split('T')[0];

          const affectedRows = await connection('payroll_employee_leave')
               .where({ id })
               .update({
                    status: 'rejected',
                    approved_by,
                    approved_date: today,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async cancelLeave(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid leave ID is required');
          }

          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               const leave = await trx('payroll_employee_leave').where({ id }).first();
               if (!leave || leave.status !== 'approved') return false;

               // Update leave status
               await trx('payroll_employee_leave')
                    .where({ id })
                    .update({ status: 'cancelled', updated_at: trx.fn.now() });

               // Restore leave balance if applicable
               if (leave.leave_type === 'annual' || leave.leave_type === 'sick') {
                    const balance = await this.getLeaveBalance(leave.employeeid, new Date().getFullYear(), trx);

                    if (balance) {
                         if (leave.leave_type === 'annual') {
                              await trx('payroll_employee_leave_balance')
                                   .where({ id: balance.id })
                                   .update({
                                        annual_leave_taken: balance.annual_leave_taken - leave.total_days,
                                        annual_leave_balance: balance.annual_leave_balance + leave.total_days,
                                        updated_at: trx.fn.now()
                                   });
                         } else if (leave.leave_type === 'sick') {
                              await trx('payroll_employee_leave_balance')
                                   .where({ id: balance.id })
                                   .update({
                                        sick_leave_taken: balance.sick_leave_taken - leave.total_days,
                                        sick_leave_balance: balance.sick_leave_balance + leave.total_days,
                                        updated_at: trx.fn.now()
                                   });
                         }
                    }
               }

               return true;
          });
     }

     // Leave Balance Operations
     async getLeaveBalance(
          employeeid: number,
          leave_year: number,
          trx?: Knex.Transaction
     ): Promise<ILeaveBalance | undefined> {
          const connection = trx || await this.connection;
          return connection('payroll_employee_leave_balance')
               .where({ employeeid, leave_year })
               .first();
     }

     async createLeaveBalance(balance: ILeaveBalance): Promise<number> {
          // Validate data using Zod schema
          leaveBalanceSchema.parse(balance);

          const connection = await this.connection;
          const [id] = await connection('payroll_employee_leave_balance').insert(balance);
          return id;
     }

     async updateLeaveBalance(id: number, balance: Partial<ILeaveBalance>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid leave balance ID is required for update');
          }

          const connection = await this.connection;

          // Get existing record to validate complete data
          const existing = await connection('payroll_employee_leave_balance').where({ id }).first();
          if (!existing) {
               throw new Error('Leave balance record not found');
          }

          // Merge with existing data for complete validation
          const completeBalance = { ...existing, ...balance };

          // Validate complete data using Zod schema
          leaveBalanceSchema.parse(completeBalance);

          const affectedRows = await connection('payroll_employee_leave_balance')
               .where({ id })
               .update({ ...balance, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async initializeLeaveBalanceForYear(employeeid: number, year: number): Promise<number> {
          if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
               throw new Error('Valid employee ID is required');
          }

          if (!year || typeof year !== 'number' || year < 2000 || year > 2100) {
               throw new Error('Valid year is required (2000-2100)');
          }

          const connection = await this.connection;

          const existing = await this.getLeaveBalance(employeeid, year);
          if (existing) {
               return existing.id!;
          }

          return this.createLeaveBalance({
               employeeid,
               leave_year: year,
               annual_leave_entitlement: 21,
               sick_leave_entitlement: 14,
               annual_leave_taken: 0,
               annual_leave_balance: 21,
               sick_leave_taken: 0,
               sick_leave_balance: 14
          });
     }

     async getEmployeesOnLeaveByDate(date: string): Promise<ILeave[]> {
          const connection = await this.connection;
          return connection('payroll_employee_leave')
               .where({ status: 'approved' })
               .where('start_date', '<=', date)
               .where('end_date', '>=', date);
     }

     async getLeaveSummaryByEmployee(
          employeeid: number,
          year: number
     ): Promise<{
          total_annual_taken: number;
          total_sick_taken: number;
          total_unpaid_taken: number;
          total_other_taken: number;
     }> {
          const connection = await this.connection;
          const startDate = `${year}-01-01`;
          const endDate = `${year}-12-31`;

          const result = await connection('payroll_employee_leave')
               .where({ employeeid, status: 'approved' })
               .whereBetween('start_date', [startDate, endDate])
               .select(
                    connection.raw("SUM(CASE WHEN leave_type = 'annual' THEN total_days ELSE 0 END) as total_annual_taken"),
                    connection.raw("SUM(CASE WHEN leave_type = 'sick' THEN total_days ELSE 0 END) as total_sick_taken"),
                    connection.raw("SUM(CASE WHEN leave_type = 'unpaid' THEN total_days ELSE 0 END) as total_unpaid_taken"),
                    connection.raw("SUM(CASE WHEN leave_type NOT IN ('annual', 'sick', 'unpaid') THEN total_days ELSE 0 END) as total_other_taken")
               )
               .first() as any;

          return result || { total_annual_taken: 0, total_sick_taken: 0, total_unpaid_taken: 0, total_other_taken: 0 };
     }
}
