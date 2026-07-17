import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface ITaxRelief {
     id?: number;
     tax_configuration_id?: number;
     relief_code?: string;
     relief_name: string;
     calculation_method: 'fixed' | 'per_dependent' | 'percentage_of_gross';
     amount: number;
     is_active: boolean;
     requires_disability: boolean;
     created_by?: number;
     updated_by?: number;
}

const taxReliefSchema = z.object({
     tax_configuration_id: z.preprocess((value) => value === null ? undefined : value, z.number().positive('Tax configuration ID must be a positive number').optional()),
     relief_code: z.preprocess((value) => value === null ? undefined : value, z.string().max(100, 'Relief code cannot exceed 100 characters').optional()),
     relief_name: z.string().min(1, 'Relief name cannot be empty').max(150, 'Relief name cannot exceed 150 characters'),
     calculation_method: z.enum(['fixed', 'per_dependent', 'percentage_of_gross']),
     amount: z.number().min(0, 'Amount cannot be negative'),
     is_active: z.boolean(),
     requires_disability: z.boolean(),
     created_by: z.preprocess((value) => value === null ? undefined : value, z.number().positive('Created by must be a positive number').optional()),
     updated_by: z.preprocess((value) => value === null ? undefined : value, z.number().positive('Updated by must be a positive number').optional())
});

export class TaxReliefRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     async create(relief: ITaxRelief): Promise<number> {
          taxReliefSchema.parse(relief);

          const connection = await this.connection;
          const [id] = await connection('payroll_tax_reliefs').insert(relief);
          return id;
     }

     async getById(id: number): Promise<ITaxRelief | undefined> {
          const connection = await this.connection;
          return connection('payroll_tax_reliefs').where({ id }).first();
     }

     async getAll(activeOnly: boolean = true): Promise<ITaxRelief[]> {
          const connection = await this.connection;

          const query = connection('payroll_tax_reliefs').orderBy('relief_name', 'asc');
          if (activeOnly) {
               query.where({ is_active: true });
          }

          return query;
     }

     async getActiveByTaxConfigurationId(taxConfigurationId?: number): Promise<ITaxRelief[]> {
          const connection = await this.connection;

          return connection('payroll_tax_reliefs')
               .where({ is_active: true })
               .modify((qb) => {
                    if (taxConfigurationId) {
                         qb.where((builder) => {
                              builder.where({ tax_configuration_id: taxConfigurationId }).orWhereNull('tax_configuration_id');
                         });
                    }
               })
               .orderBy('id', 'asc');
     }

     async update(id: number, relief: Partial<ITaxRelief>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid tax relief ID is required for update');
          }

          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Tax relief record not found');
          }

          const completeRelief = { ...existing, ...relief };
          taxReliefSchema.parse(completeRelief);

          const connection = await this.connection;
          const affectedRows = await connection('payroll_tax_reliefs')
               .where({ id })
               .update({ ...relief, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async deactivate(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid tax relief ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_tax_reliefs')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }
}