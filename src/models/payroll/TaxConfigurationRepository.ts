import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';
import { promisifyQuery } from '../../hooks/helper';

export interface ITaxConfiguration {
     id?: number;
     tax_year: string;
     country: string;
     tax_bands: any;
     is_active: boolean;
     created_by?: number;
     created_by_name?: string;
     updated_by?: number;
     updated_by_name?: string;
     created_at?: string | Date;
     updated_at?: string | Date;
}

const taxConfigurationSchema = z.object({
     tax_year: z.string().regex(/^\d{4}$/, 'Tax year must be a 4-digit year'),
     country: z.string().min(1, 'Country cannot be empty').max(100, 'Country cannot exceed 100 characters'),
     tax_bands: z.any().refine((value) => {
          if (!value) return false;
          try {
               const parsed = typeof value === 'string' ? JSON.parse(value) : value;
               return Array.isArray(parsed) && parsed.length > 0;
          } catch {
               return false;
          }
     }, 'Tax bands must be a valid JSON array with at least one band'),
     is_active: z.boolean(),
     created_by: z.number().positive('Created by must be a positive number').optional(),
     updated_by: z.number().positive('Updated by must be a positive number').optional()
});

export class TaxConfigurationRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private parseConfigDetails(config: any): ITaxConfiguration {
          return {
               id: config.id ? Number(config.id) : undefined,
               tax_year: String(config.tax_year),
               country: String(config.country),
               tax_bands: config.tax_bands ?
                    (typeof config.tax_bands === 'string' ? JSON.parse(config.tax_bands) : config.tax_bands) :
                    [],
               is_active: Boolean(config.is_active),
               created_by: config.created_by ? Number(config.created_by) : undefined,
               created_by_name: config.created_by_name || undefined,
               created_at: config.created_at ?
                    (config.created_at instanceof Date ?
                         config.created_at.toISOString().slice(0, 19) :
                         String(config.created_at)) :
                    undefined,
               updated_at: config.updated_at ?
                    (config.updated_at instanceof Date ?
                         config.updated_at.toISOString().slice(0, 19) :
                         String(config.updated_at)) :
                    undefined
          };
     } async create(config: ITaxConfiguration): Promise<number> {
          taxConfigurationSchema.parse(config);
          const connection = await this.connection;
          const dataToInsert = {
               ...config,
               tax_bands: typeof config.tax_bands === 'string'
                    ? config.tax_bands
                    : JSON.stringify(config.tax_bands)
          };

          return connection.transaction(async (trx) => {
               if (config.is_active) {
                    await trx('payroll_tax_configuration').update({ is_active: false });
               }

               const [id] = await trx('payroll_tax_configuration').insert(dataToInsert);

               if (config.is_active) {
                    const activeCount = await trx('payroll_tax_configuration')
                         .where({ is_active: true })
                         .count('id as count')
                         .first();

                    if (activeCount && Number(activeCount.count) > 1) {
                         throw new Error('Multiple tax configurations cannot be active simultaneously');
                    }
               }

               return id;
          });
     }

     async getByTaxYear(tax_year: string): Promise<ITaxConfiguration | undefined> {
          const connection = await this.connection;
          const result = await connection('payroll_tax_configuration')
               .leftJoin('roles as creator', 'payroll_tax_configuration.created_by', 'creator.employeeid')
               .leftJoin('roles as updater', 'payroll_tax_configuration.updated_by', 'updater.employeeid')
               .select(
                    'payroll_tax_configuration.*',
                    'creator.username as created_by_name',
                    'updater.username as updated_by_name'
               )
               .where('payroll_tax_configuration.tax_year', tax_year)
               .first();
          return result ? this.parseConfigDetails(result) : undefined;
     }

     async getActive(): Promise<ITaxConfiguration | undefined> {
          const connection = await this.connection;
          const result = await connection('payroll_tax_configuration')
               .leftJoin('roles as creator', 'payroll_tax_configuration.created_by', 'creator.employeeid')
               .leftJoin('roles as updater', 'payroll_tax_configuration.updated_by', 'updater.employeeid')
               .select(
                    'payroll_tax_configuration.*',
                    'creator.username as created_by_name',
                    'updater.username as updated_by_name'
               )
               .where('payroll_tax_configuration.is_active', true)
               .orderBy('payroll_tax_configuration.tax_year', 'desc')
               .first();
          return result ? this.parseConfigDetails(result) : undefined;
     }

     async getCurrentYearConfig(): Promise<ITaxConfiguration | undefined> {
          const currentYear = new Date().getFullYear().toString();
          const result = await this.getByTaxYear(currentYear);
          return result;
     }

     async getById(id: number): Promise<ITaxConfiguration | undefined> {
          const connection = await this.connection;
          const result = await connection('payroll_tax_configuration')
               .leftJoin('roles as creator', 'payroll_tax_configuration.created_by', 'creator.employeeid')
               .leftJoin('roles as updater', 'payroll_tax_configuration.updated_by', 'updater.employeeid')
               .select(
                    'payroll_tax_configuration.*',
                    'creator.username as created_by_name',
                    'updater.username as updated_by_name'
               )
               .where('payroll_tax_configuration.id', id)
               .first();
          return result ? this.parseConfigDetails(result) : undefined;
     }

     async update(id: number, config: Partial<ITaxConfiguration>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid tax configuration ID is required for update');
          }

          const existing = await this.getById(id);
          if (!existing) {
               throw new Error(`Tax configuration with ID ${id} not found`);
          }

          console.log('UPDATE DEBUG - Existing record:', existing);
          console.log('UPDATE DEBUG - Update config:', config);

          const completeConfig = { ...existing, ...config };

          taxConfigurationSchema.parse(completeConfig);

          const connection = await this.connection;

          try {
               await promisifyQuery(this.tenantId, 'DROP TRIGGER IF EXISTS payroll_tax_configuration_update_audit_trigger');
          } catch (triggerError) {
               console.log('Trigger drop failed (may not exist):', triggerError);
          }
          return connection.transaction(async (trx) => {
               const dataToUpdate = { ...config };
               if (dataToUpdate.tax_bands !== undefined) {
                    dataToUpdate.tax_bands = typeof dataToUpdate.tax_bands === 'string'
                         ? dataToUpdate.tax_bands
                         : JSON.stringify(dataToUpdate.tax_bands);
               }

               console.log('UPDATE DEBUG - Data to update:', dataToUpdate);

               const affectedRows = await trx('payroll_tax_configuration')
                    .where({ id })
                    .update({ ...dataToUpdate, updated_at: trx.fn.now() });

               if (config.is_active === true) {
                    const activeCount = await trx('payroll_tax_configuration')
                         .where({ is_active: true })
                         .count('id as count')
                         .first();

                    if (activeCount && Number(activeCount.count) > 1) {
                         throw new Error('Multiple tax configurations cannot be active simultaneously');
                    }
               }

               return affectedRows > 0;
          });
     }

     async deactivate(id: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid tax configuration ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_tax_configuration')
               .where({ id })
               .update({ is_active: false, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getAll(): Promise<ITaxConfiguration[]> {
          const connection = await this.connection;
          const results = await connection('payroll_tax_configuration')
               .leftJoin('roles as creator', 'payroll_tax_configuration.created_by', 'creator.employeeid')
               .leftJoin('roles as updater', 'payroll_tax_configuration.updated_by', 'updater.employeeid')
               .select(
                    'payroll_tax_configuration.*',
                    'creator.username as created_by_name',
                    'updater.username as updated_by_name'
               )
               .orderBy('payroll_tax_configuration.tax_year', 'desc');

          return results.map(result => this.parseConfigDetails(result));
     }

     async setActiveYear(tax_year: string): Promise<boolean> {
          if (!tax_year || typeof tax_year !== 'string' || !/^\d{4}$/.test(tax_year)) {
               throw new Error('Valid tax year is required (4-digit year)');
          }

          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               await trx('payroll_tax_configuration').update({ is_active: false });

               const affectedRows = await trx('payroll_tax_configuration')
                    .where({ tax_year })
                    .update({ is_active: true, updated_at: trx.fn.now() });

               const activeCount = await trx('payroll_tax_configuration')
                    .where({ is_active: true })
                    .count('id as count')
                    .first();

               if (activeCount && Number(activeCount.count) !== 1) {
                    throw new Error('Exactly one tax configuration must be active');
               }

               return affectedRows > 0;
          });
     }

     async createDefaultConfig(tax_year: string): Promise<number> {
          const defaultTaxBands = [
               { min: 0, max: 4380, rate: 0 },
               { min: 4381, max: 6000, rate: 5 },
               { min: 6001, max: 9600, rate: 10 },
               { min: 9601, max: 38400, rate: 17.5 },
               { min: 38401, max: 240000, rate: 25 },
               { min: 240001, max: 480000, rate: 30 },
               { min: 480001, max: null, rate: 35 }
          ];

          return this.create({
               tax_year,
               country: 'Ghana',
               tax_bands: JSON.stringify(defaultTaxBands),
               is_active: true
          });
     }

     async getAuditHistory(taxConfigId: number): Promise<any[]> {
          if (!taxConfigId || typeof taxConfigId !== 'number' || taxConfigId <= 0) {
               throw new Error('Valid tax configuration ID is required');
          }

          const connection = await this.connection;
          const results = await connection('payroll_tax_configuration_audit')
               .where('tax_config_id', taxConfigId)
               .orderBy('operation_timestamp', 'desc');

          return results.map(result => ({
               ...result,
               operation_timestamp: result.operation_timestamp
          }));
     }
}
