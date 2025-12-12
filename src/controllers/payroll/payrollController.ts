import { Request, Response } from 'express';
import { PayrollProcessingService } from '../../services/payroll/PayrollProcessingService';
import { PayrollPeriodRepository } from '../../models/payroll/PayrollPeriodRepository';
import { PayrollTransactionRepository } from '../../models/payroll/PayrollTransactionRepository';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { customError } from '../../hooks/helper';

/**
 * Create new payroll period
 */
export const createPayrollPeriodHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);

          const service = new PayrollProcessingService(tenantId);
          const periodId = await service.createPayrollPeriod();

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Payroll period created successfully',
               result: { id: periodId }
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get all payroll periods
 */
export const getAllPayrollPeriodsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);

          const repo = new PayrollPeriodRepository(tenantId);
          const periods = await repo.getAll();

          res.json({
               status: 'success',
               statusCode: 200,
               result: periods
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get payroll period by ID
 */
export const getPayrollPeriodByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          const repo = new PayrollPeriodRepository(tenantId);
          const period = await repo.getById(id);

          if (!period) {
               return customError('Payroll period not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: period
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Process payroll for a period
 */
export const processPayrollHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);
          const { employeeIds, calculated_by } = req.body;

          if (!periodId) {
               return customError('Period ID is required', 400, res);
          }

          if (!employeeIds || !Array.isArray(employeeIds)) {
               return customError('Employee IDs array is required', 400, res);
          }

          if (!calculated_by) {
               return customError('Calculated by user ID is required', 400, res);
          }

          const service = new PayrollProcessingService(tenantId);
          const result = await service.processPayrollPeriod(periodId, employeeIds, calculated_by);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Payroll processed successfully',
               result
          });
     } catch (error) {
          console.error('Process payroll error:', error);
          customError('Failed to process payroll', 500, res);
     }
};

/**
 * Approve payroll period
 */
export const approvePayrollHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);
          const { approved_by } = req.body;

          if (!periodId) {
               return customError('Period ID is required', 400, res);
          }

          if (!approved_by) {
               return customError('Approved by user ID is required', 400, res);
          }

          const service = new PayrollProcessingService(tenantId);
          await service.approvePayrollPeriod(periodId, approved_by);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Payroll period approved successfully'
          });
     } catch (error: any) {
          // Handle business logic errors
          if (error.message && error.message.includes('Cannot approve')) {
               return customError(error.message, 400, res);
          }
          if (error.message && error.message.includes('not found')) {
               return customError(error.message, 404, res);
          }
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Lock payroll period
 */
export const lockPayrollHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);
          const { locked_by } = req.body;

          if (!periodId) {
               return customError('Period ID is required', 400, res);
          }

          if (!locked_by) {
               return customError('Locked by user ID is required', 400, res);
          }

          const service = new PayrollProcessingService(tenantId);
          await service.lockPayrollPeriod(periodId, locked_by);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Payroll period locked successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Mark payroll as paid
 */
export const markPayrollPaidHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);
          const { payment_date, payment_method, payment_references } = req.body;

          if (!periodId) {
               return customError('Period ID is required', 400, res);
          }

          if (!payment_date || !payment_method) {
               return customError('Payment date and method are required', 400, res);
          }

          const referencesMap = payment_references
               ? new Map(Object.entries(payment_references).map(([k, v]) => [parseInt(k), v as string]))
               : undefined;

          const service = new PayrollProcessingService(tenantId);
          await service.markPayrollAsPaid(periodId, payment_date, payment_method, referencesMap);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Payroll marked as paid successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Recalculate employee payroll
 */
export const recalculateEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);
          const { employeeid } = req.body;

          if (!tenantId || !periodId) {
               return customError('Tenant ID and Period ID are required', 400, res);
          }

          if (!employeeid) {
               return customError('Employee ID is required', 400, res);
          }

          const service = new PayrollProcessingService(tenantId);
          await service.recalculateEmployee(periodId, employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Employee payroll recalculated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get payroll period status
 */
export const getPayrollStatusHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);

          if (!tenantId || !periodId) {
               return customError('Tenant ID and Period ID are required', 400, res);
          }

          const service = new PayrollProcessingService(tenantId);
          const status = await service.getPayrollStatus(periodId);

          res.json({
               status: 'success',
               statusCode: 200,
               result: status
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get payroll transactions for period
 */
export const getPayrollTransactionsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const periodId = parseInt(req.params.id);
          const count = parseInt(req.query.count as string) || 10;
          const page = parseInt(req.query.page as string) || 1;

          if (!periodId) return customError('Period ID are required', 400, res);
          const repo = new PayrollTransactionRepository(tenantId);
          const transactions = await repo.getPeriodTransactionsWithEmployeeDetails(periodId, count, page);
          res.json({
               status: 'success',
               statusCode: 200,
               result: transactions
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get employee payroll history
 */
export const getEmployeePayrollHistoryHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and Employee ID are required', 400, res);
          }

          const repo = new PayrollTransactionRepository(tenantId);
          const transactions = await repo.getByEmployeeId(employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               result: transactions
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get employee YTD totals
 */
export const getEmployeeYTDHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);
          const year = parseInt(req.query.year as string) || new Date().getFullYear();

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and Employee ID are required', 400, res);
          }

          const repo = new PayrollTransactionRepository(tenantId);
          const ytd = await repo.getEmployeeYTDTotals(employeeid, year);

          res.json({
               status: 'success',
               statusCode: 200,
               result: ytd
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};
