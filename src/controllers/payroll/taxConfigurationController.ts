import {ensureGhanaPayrollSchema} from '../../models/payroll/GhanaPayrollSchema';
import { Request, Response } from 'express';
import { TaxConfigurationRepository, ITaxConfiguration } from '../../models/payroll/TaxConfigurationRepository';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { customError } from '../../hooks/helper';

/**
 * Create a new tax configuration
 */
export const createTaxConfigurationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const configData: ITaxConfiguration = req.body;
          configData.created_by = req.body.created_by;
          if (!configData.is_active) configData.is_active = false;
          const repo = new TaxConfigurationRepository(tenantId);
          const id = await repo.create(configData);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Tax configuration created successfully',
               result: { id }
          });
     } catch (error: any) {
          if (error?.code == "ER_DUP_ENTRY") {
               customError('A tax configuration for this year already exists', 400, res);
          }
          customError('Failed to create tax configuration', 500, res);
     }
};

/**
 * Get all tax configurations
 */
export const getAllTaxConfigurationsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);


          const repo = new TaxConfigurationRepository(tenantId);
          const connection = await repo['connection']; // Access private connection

          await ensureGhanaPayrollSchema(connection);
          const configs = await repo.getAll();

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax configurations retrieved successfully',
               result: configs
          });
     } catch (error: any) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get active tax configuration
 */
export const getActiveTaxConfigurationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const config = await repo.getActive();

          if (!config) {
               return customError('No active tax configuration found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Active tax configuration retrieved successfully',
               result: config
          });
     } catch (error: any) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Update tax configuration
 */
export const updateTaxConfigurationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);


          const id = parseInt(req.params.id.toString());
          if (!id) {
               return customError('Valid tax configuration ID is required', 400, res);
          }

          const updates = req.body;

          // Set updated_by if provided in request body
          if (req.body.updated_by) {
               updates.updated_by = req.body.updated_by;
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const success = await repo.update(id, updates);

          if (!success) {
               return customError('Tax configuration not found or update failed', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax configuration updated successfully'
          });
     } catch (error: any) {
          console.error('Update tax configuration error:', error);
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get tax configuration by ID
 */
export const getTaxConfigurationByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const id = parseInt(req.params.id.toString());
          if (!id) {
               return customError('Valid tax configuration ID is required', 400, res);
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const config = await repo.getById(id);

          if (!config) {
               return customError('Tax configuration not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax configuration retrieved successfully',
               result: config
          });
     } catch (error: any) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get tax configuration by tax year
 */
export const getTaxConfigurationByYearHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const taxYear = req.params.taxYear as string;
          if (!taxYear || !/^\d{4}$/.test(taxYear)) {
               return customError('Valid 4-digit tax year is required', 400, res);
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const config = await repo.getByTaxYear(taxYear);

          if (!config) {
               return customError('Tax configuration not found for the specified year', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax configuration retrieved successfully',
               result: config
          });
     } catch (error: any) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Activate/Deactivate tax configuration
 */
export const toggleTaxConfigurationStatusHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const id = parseInt(req.params.id.toString());
          if (!id) {
               return customError('Valid tax configuration ID is required', 400, res);
          }

          const { is_active } = req.body;
          if (typeof is_active !== 'boolean') {
               return customError('is_active must be a boolean value', 400, res);
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const success = await repo.update(id, { is_active });

          res.json({
               status: 'success',
               statusCode: 200,
               message: `Tax configuration ${is_active ? 'activated' : 'deactivated'} successfully`,
               result: { success }
          });
     } catch (error: any) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Delete tax configuration
 */
export const deleteTaxConfigurationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const id = parseInt(req.params.id.toString());
          if (!id) {
               return customError('Valid tax configuration ID is required', 400, res);
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const connection = await repo['connection'];

          // Check if configuration exists
          const existing = await connection('payroll_tax_configuration').where({ id }).first();
          if (!existing) {
               return customError('Tax configuration not found', 404, res);
          }

          if(existing.managed_by==='ghana_setup')return customError('Ghana PAYE presets are versioned. Manage this configuration through Ghana payroll setup.',400,res);
          // Check if it's active
          if (existing.is_active) {
               return customError('Cannot delete active tax configuration', 400, res);
          }

          await connection('payroll_tax_configuration').where({ id }).del();

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax configuration deleted successfully'
          });
     } catch (error: any) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get audit history for a tax configuration
 */
export const getTaxConfigurationAuditHistoryHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const id = parseInt(req.params.id.toString());
          if (!id) {
               return customError('Valid tax configuration ID is required', 400, res);
          }

          const repo = new TaxConfigurationRepository(tenantId);
          const auditHistory = await repo.getAuditHistory(id);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax configuration audit history retrieved successfully',
               result: auditHistory
          });
     } catch (error: any) {
          console.error('Get tax configuration audit history error:', error);
          PrimeSqlErrorHandler.handleError(error, res);
     }
};