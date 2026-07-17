import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface IDeductionDefinition {
     id?: number;
     deduction_code: string;
     deduction_name: string;
     default_calculation_method: 'fixed_amount' | 'percentage_of_gross';
     default_amount?: number;
     application_scope: 'all_employees' | 'specific_employees' | 'specific_roles';
     target_employee_ids?: number[];
     target_roles?: string[];
     is_statutory: boolean;
     is_active: boolean;
     created_by?: number;
     updated_by?: number;
}

const parseJsonArray = <T>(value: unknown): T[] | undefined => {
     if (value === null || value === undefined || value === '') {
          return undefined;
     }

     if (Array.isArray(value)) {
          return value as T[];
     }

     if (typeof value === 'string') {
          return JSON.parse(value) as T[];
     }

     return undefined;
};

const deductionDefinitionSchema = z.object({
     deduction_code: z.string().min(1, 'Deduction code cannot be empty').max(100, 'Deduction code cannot exceed 100 characters'),
     deduction_name: z.string().min(1, 'Deduction name cannot be empty').max(150, 'Deduction name cannot exceed 150 characters'),
     default_calculation_method: z.enum(['fixed_amount', 'percentage_of_gross']),
     default_amount: z.preprocess((value) => value === null ? undefined : value, z.number().min(0, 'Default amount cannot be negative').optional()),
     application_scope: z.enum(['all_employees', 'specific_employees', 'specific_roles']),
     target_employee_ids: z.preprocess((value) => parseJsonArray<number>(value), z.array(z.number().positive()).optional()),
     target_roles: z.preprocess((value) => parseJsonArray<string>(value), z.array(z.string().min(1).max(100)).optional()),
     is_statutory: z.boolean(),
     is_active: z.boolean(),
     created_by: z.preprocess((value) => value === null ? undefined : value, z.number().positive('Created by must be a positive number').optional()),
     updated_by: z.preprocess((value) => value === null ? undefined : value, z.number().positive('Updated by must be a positive number').optional())
});

export class DeductionDefinitionRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private parseDefinition(definition: any): IDeductionDefinition {
          return {
               id: definition.id ? Number(definition.id) : undefined,
               deduction_code: String(definition.deduction_code),
               deduction_name: String(definition.deduction_name),
               default_calculation_method: definition.default_calculation_method,
               default_amount: definition.default_amount !== null && definition.default_amount !== undefined
                    ? Number(definition.default_amount)
                    : undefined,
               application_scope: definition.application_scope,
               target_employee_ids: parseJsonArray<number>(definition.target_employee_ids),
               target_roles: parseJsonArray<string>(definition.target_roles),
               is_statutory: Boolean(definition.is_statutory),
               is_active: Boolean(definition.is_active),
               created_by: definition.created_by ? Number(definition.created_by) : undefined,
               updated_by: definition.updated_by ? Number(definition.updated_by) : undefined
          };
     }

     private serializeDefinition(definition: Partial<IDeductionDefinition>) {
          return {
               ...definition,
               target_employee_ids: definition.target_employee_ids !== undefined
                    ? JSON.stringify(definition.target_employee_ids)
                    : definition.target_employee_ids,
               target_roles: definition.target_roles !== undefined
                    ? JSON.stringify(definition.target_roles)
                    : definition.target_roles
          };
     }

     async create(definition: IDeductionDefinition): Promise<number> {
          deductionDefinitionSchema.parse(definition);

          const connection = await this.connection;
          const [id] = await connection('payroll_deduction_definitions').insert(this.serializeDefinition(definition));
          return id;
     }

     async getById(id: number): Promise<IDeductionDefinition | undefined> {
          const connection = await this.connection;
          const definition = await connection('payroll_deduction_definitions').where({ id }).first();
          return definition ? this.parseDefinition(definition) : undefined;
     }

     async getAll(activeOnly: boolean = true): Promise<IDeductionDefinition[]> {
          const connection = await this.connection;
          const query = connection('payroll_deduction_definitions').orderBy('deduction_name', 'asc');

          if (activeOnly) {
               query.where({ is_active: true });
          }

          const results = await query;
          return results.map((definition) => this.parseDefinition(definition));
     }

     async update(id: number, definition: Partial<IDeductionDefinition>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid deduction definition ID is required for update');
          }

          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Deduction definition record not found');
          }

          const completeDefinition = { ...existing, ...definition };
          deductionDefinitionSchema.parse(completeDefinition);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_deduction_definitions')
               .where({ id })
               .update({ ...this.serializeDefinition(definition), updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async deactivate(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid deduction definition ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_deduction_definitions')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getApplicableDefinitions(employeeid: number): Promise<IDeductionDefinition[]> {
          const connection = await this.connection;
          const definitions = await this.getAll(true);
          const roleRow = await connection('roles').select('role').where({ employeeid }).first();
          const employeeRole = roleRow?.role ? String(roleRow.role) : undefined;

          return definitions.filter((definition) => {
               switch (definition.application_scope) {
                    case 'specific_employees':
                         return definition.target_employee_ids?.includes(employeeid) ?? false;
                    case 'specific_roles':
                         return employeeRole ? definition.target_roles?.includes(employeeRole) ?? false : false;
                    default:
                         return true;
               }
          });
     }
}