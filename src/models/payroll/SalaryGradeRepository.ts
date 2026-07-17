import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface ISalaryGrade {
     id?: number;
     grade_name: string;
     grade_level: string;
     role_name?: string;
     min_salary?: number;
     max_salary?: number;
     description?: string;
     currency?: string;
     is_active: boolean;
     created_by?: number;
     updated_by?: number;
}

// Zod validation schema
const salaryGradeSchema = z.object({
     grade_name: z.string().min(1, 'Grade name cannot be empty').max(100, 'Grade name cannot exceed 100 characters'),
     grade_level: z.string().min(1, 'Grade level cannot be empty').max(50, 'Grade level cannot exceed 50 characters'),
     role_name: z.preprocess((val) => val === null ? undefined : val, z.string().max(100, 'Role name cannot exceed 100 characters').optional()),
     min_salary: z.preprocess((val) => val === null ? undefined : val, z.number().min(0, 'Minimum salary cannot be negative').optional()),
     max_salary: z.preprocess((val) => val === null ? undefined : val, z.number().min(0, 'Maximum salary cannot be negative').optional()),
     description: z.preprocess((val) => val === null ? undefined : val, z.string().max(10000, 'Description cannot exceed 500 characters').optional()),
     currency: z.preprocess((val) => val === null ? undefined : val, z.string().max(3, 'Currency code cannot exceed 3 characters').optional()),
     is_active: z.boolean(),
     created_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Created by must be a positive number').optional()),
     updated_by: z.preprocess((val) => val === null ? undefined : val, z.number().positive('Updated by must be a positive number').optional())
}).refine((data) => {
     if (data.min_salary !== undefined && data.max_salary !== undefined) {
          return data.max_salary >= data.min_salary;
     }
     return true;
}, {
     message: 'Maximum salary must be greater than or equal to minimum salary',
     path: ['max_salary']
});

export class SalaryGradeRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private async ensureRoleExists(connection: Knex, roleName?: string): Promise<void> {
          if (!roleName) {
               return;
          }

          const roleRecord = await connection('roles').where({ role: roleName }).first();
          if (!roleRecord) {
               throw new Error(`Role ${roleName} was not found in roles table`);
          }
     }

     private async ensureUniqueRoleMapping(connection: Knex, roleName?: string, ignoreId?: number): Promise<void> {
          if (!roleName) {
               return;
          }

          const existing = await connection('payroll_salary_grades')
               .where({ role_name: roleName, is_active: true })
               .modify((qb) => {
                    if (ignoreId) {
                         qb.whereNot('id', ignoreId);
                    }
               })
               .first();

          if (existing) {
               throw new Error(`An active salary grade already exists for role ${roleName}`);
          }
     }

     async create(salaryGrade: ISalaryGrade): Promise<number> {
          const connection = await this.connection;
          const normalizedSalaryGrade = {
               ...salaryGrade,
               role_name: salaryGrade.role_name ?? salaryGrade.grade_name,
               grade_name: salaryGrade.grade_name ?? salaryGrade.role_name ?? ''
          };

          salaryGradeSchema.parse(normalizedSalaryGrade);
          await this.ensureRoleExists(connection, normalizedSalaryGrade.role_name);
          await this.ensureUniqueRoleMapping(connection, normalizedSalaryGrade.role_name);

          const [id] = await connection('payroll_salary_grades').insert(normalizedSalaryGrade);
          return id;
     }

     async getById(id: number): Promise<ISalaryGrade | undefined> {
          const connection = await this.connection;
          return connection('payroll_salary_grades').where({ id }).first();
     }

     async getByName(gradeName: string): Promise<ISalaryGrade | undefined> {
          const connection = await this.connection;
          return connection('payroll_salary_grades').where({ grade_name: gradeName, is_active: true }).first();
     }

     async getAll(activeOnly: boolean = true): Promise<ISalaryGrade[]> {
          const connection = await this.connection;

          let query = connection('payroll_salary_grades')
               .orderBy('grade_level')
               .orderBy('grade_name');

          if (activeOnly) {
               query = query.where({ is_active: true });
          }

          return query;
     }

     async update(id: number, salaryGrade: Partial<ISalaryGrade>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid salary grade ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Salary grade record not found');
          }

          const connection = await this.connection;
          const completeGrade = {
               ...existing,
               ...salaryGrade,
               role_name: salaryGrade.role_name ?? existing.role_name ?? salaryGrade.grade_name ?? existing.grade_name,
               grade_name: salaryGrade.grade_name ?? existing.grade_name ?? salaryGrade.role_name ?? existing.role_name ?? ''
          };

          salaryGradeSchema.parse(completeGrade);
          await this.ensureRoleExists(connection, completeGrade.role_name);
          await this.ensureUniqueRoleMapping(connection, completeGrade.role_name, id);

          const affectedRows = await connection('payroll_salary_grades')
               .where({ id })
               .update({ ...salaryGrade, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getAvailableRoles(): Promise<string[]> {
          const connection = await this.connection;
          const rows = await connection('roles').distinct('role').orderBy('role', 'asc');
          return rows.map((row: { role: string }) => row.role);
     }

     async deactivate(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid salary grade ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_salary_grades')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getGradesInSalaryRange(minSalary: number, maxSalary: number): Promise<ISalaryGrade[]> {
          const connection = await this.connection;

          return connection('payroll_salary_grades')
               .where({ is_active: true })
               .where('min_salary', '>=', minSalary)
               .where('max_salary', '<=', maxSalary)
               .orderBy('grade_level');
     }
}