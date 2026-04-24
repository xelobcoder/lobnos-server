import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface ISalaryGrade {
     id?: number;
     grade_name: string;
     grade_level: string;
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

     async create(salaryGrade: ISalaryGrade): Promise<number> {
          // Validate data using Zod schema
          salaryGradeSchema.parse(salaryGrade);

          const connection = await this.connection;
          const [id] = await connection('payroll_salary_grades').insert(salaryGrade);
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

          // Merge with existing data for complete validation
          const completeGrade = { ...existing, ...salaryGrade };

          // Validate complete data using Zod schema
          salaryGradeSchema.parse(completeGrade);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_salary_grades')
               .where({ id })
               .update({ ...salaryGrade, updated_at: connection.fn.now() });
          return affectedRows > 0;
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