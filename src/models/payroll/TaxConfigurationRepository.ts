import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface ITaxConfiguration {
     id?: number;
     tax_year: string;
     country: string;
     tax_bands: any; // JSON structure
     standard_exemption: number;
     dependent_relief: number;
     disability_exemption: number;
     employee_ssnit_rate: number;
     employer_ssnit_rate: number;
     tier3_employee_rate: number;
     tier3_employer_rate: number;
     ssnit_ceiling?: number;
     pension_ceiling?: number;
     is_active: boolean;
     created_by?: number;
}

// Zod validation schema
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
     standard_exemption: z.number().min(0, 'Standard exemption cannot be negative'),
     dependent_relief: z.number().min(0, 'Dependent relief cannot be negative'),
     disability_exemption: z.number().min(0, 'Disability exemption cannot be negative'),
     employee_ssnit_rate: z.number().min(0, 'Employee SSNIT rate cannot be negative').max(100, 'Employee SSNIT rate cannot exceed 100%'),
     employer_ssnit_rate: z.number().min(0, 'Employer SSNIT rate cannot be negative').max(100, 'Employer SSNIT rate cannot exceed 100%'),
     tier3_employee_rate: z.number().min(0, 'Tier 3 employee rate cannot be negative').max(100, 'Tier 3 employee rate cannot exceed 100%'),
     tier3_employer_rate: z.number().min(0, 'Tier 3 employer rate cannot be negative').max(100, 'Tier 3 employer rate cannot exceed 100%'),
     ssnit_ceiling: z.number().min(0, 'SSNIT ceiling cannot be negative').nullable().optional(),
     pension_ceiling: z.number().min(0, 'Pension ceiling cannot be negative').nullable().optional(),
     is_active: z.boolean(),
     created_by: z.number().positive('Created by must be a positive number').optional()
});

export class TaxConfigurationRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     async create(config: ITaxConfiguration): Promise<number> {
          taxConfigurationSchema.parse(config);
          const connection = await this.connection;
          const dataToInsert = {
               ...config,
               tax_bands: typeof config.tax_bands === 'string'
                    ? config.tax_bands
                    : JSON.stringify(config.tax_bands)
          };

          const [id] = await connection('payroll_tax_configuration').insert(dataToInsert);
          return id;
     }

     async getById(id: number): Promise<ITaxConfiguration | undefined> {
          const connection = await this.connection;
          const result = await connection('payroll_tax_configuration').where({ id }).first();
          if (result && result.tax_bands) {
               result.tax_bands = JSON.parse(result.tax_bands);
          }
          return result;
     }

     async getByTaxYear(tax_year: string): Promise<ITaxConfiguration | undefined> {
          const connection = await this.connection;
          const result = await connection('payroll_tax_configuration').where({ tax_year }).first();
          if (result && result.tax_bands) {
               result.tax_bands = JSON.parse(result.tax_bands);
          }
          return result;
     }

     async getActive(): Promise<ITaxConfiguration | undefined> {
          const connection = await this.connection;
          const result = await connection('payroll_tax_configuration')
               .where({ is_active: true })
               .orderBy('tax_year', 'desc')
               .first();
          if (result && result.tax_bands) {
               result.tax_bands = JSON.parse(result.tax_bands);
          }
          return result;
     }

     async getCurrentYearConfig(): Promise<ITaxConfiguration | undefined> {
          const currentYear = new Date().getFullYear().toString();
          const result = await this.getByTaxYear(currentYear);
          return result;
     }

     async update(id: number, config: Partial<ITaxConfiguration>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid tax configuration ID is required for update');
          }

          // Get existing record to validate complete data
          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Tax configuration record not found');
          }

          // Merge with existing data for complete validation
          const completeConfig = { ...existing, ...config };

          // Validate complete data using Zod schema
          taxConfigurationSchema.parse(completeConfig);

          const connection = await this.connection;

          // Ensure tax_bands is properly JSON stringified if provided
          const dataToUpdate = { ...config };
          if (dataToUpdate.tax_bands !== undefined) {
               dataToUpdate.tax_bands = typeof dataToUpdate.tax_bands === 'string'
                    ? dataToUpdate.tax_bands
                    : JSON.stringify(dataToUpdate.tax_bands);
          }

          const affectedRows = await connection('payroll_tax_configuration')
               .where({ id })
               .update({ ...dataToUpdate, updated_at: connection.fn.now() });
          return affectedRows > 0;
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
               .orderBy('tax_year', 'desc');

          // Parse tax_bands for each result
          results.forEach(result => {
               if (result.tax_bands) {
                    result.tax_bands = JSON.parse(result.tax_bands);
               }
          });

          return results;
     }

     async setActiveYear(tax_year: string): Promise<boolean> {
          if (!tax_year || typeof tax_year !== 'string' || !/^\d{4}$/.test(tax_year)) {
               throw new Error('Valid tax year is required (4-digit year)');
          }

          const connection = await this.connection;

          return connection.transaction(async (trx) => {
               // Deactivate all
               await trx('payroll_tax_configuration').update({ is_active: false });

               // Activate specified year
               const affectedRows = await trx('payroll_tax_configuration')
                    .where({ tax_year })
                    .update({ is_active: true, updated_at: trx.fn.now() });

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
               standard_exemption: 0,
               dependent_relief: 0,
               disability_exemption: 0,
               employee_ssnit_rate: 5.5,
               employer_ssnit_rate: 13,
               tier3_employee_rate: 5,
               tier3_employer_rate: 5,
               is_active: true
          });
     }
}
