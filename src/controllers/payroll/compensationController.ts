import { Request, Response } from 'express';
import { CompensationRepository } from '../../models/payroll/CompensationRepository';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { customError } from '../../hooks/helper';

/**
 * Create new compensation record
 */
export const createCompensationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const compensationData = req.body;
          const repo = new CompensationRepository(tenantId);

          const id = await repo.create(compensationData);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Compensation record created successfully',
               result: { id }
          });
     } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message) {
               return customError(message, 400, res);
          }
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get compensation by employee ID
 */
export const getCompensationByEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid.toString());

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and Employee ID are required', 400, res);
          }

          const repo = new CompensationRepository(tenantId);
          const compensation = await repo.getByEmployeeId(employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               result: compensation
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get compensation by ID
 */
export const getCompensationByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and Compensation ID are required', 400, res);
          }

          const repo = new CompensationRepository(tenantId);
          const compensation = await repo.getById(id);

          if (!compensation) {
               return customError('Compensation record not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: compensation
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get active compensation for employee
 */
export const getActiveCompensationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.query.employeeid as string);



          const repo = new CompensationRepository(tenantId);
          const compensation = employeeid && typeof employeeid === 'number' ? await repo.getActiveByEmployeeId(employeeid) : await repo.getAllActive();

          if (!compensation) {
               return customError('No active compensation found for employee', 404, res);
          }

          const result = Array.isArray(compensation) ? compensation : [compensation];

          res.json({
               status: 'success',
               statusCode: 200,
               result
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Update compensation record
 */
export const updateCompensationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and Compensation ID are required', 400, res);
          }

          const compensationData = req.body;
          const repo = new CompensationRepository(tenantId);

          const success = await repo.update(id, compensationData);

          if (!success) {
               return customError('Failed to update compensation record', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Compensation record updated successfully'
          });
     } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return customError(message || 'Failed to update compensation record', 400, res);
     }
};

/**
 * Create new compensation with history
 */
export const createCompensationWithHistoryHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid.toString());

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and Employee ID are required', 400, res);
          }

          const { newCompensation, endDate } = req.body;

          if (!newCompensation || !endDate) {
               return customError('New compensation data and end date are required', 400, res);
          }

          const repo = new CompensationRepository(tenantId);
          const id = await repo.createWithHistory(employeeid, newCompensation, endDate);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Compensation updated with history',
               result: { id }
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Deactivate compensation record
 */
export const deactivateCompensationHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and Compensation ID are required', 400, res);
          }

          const repo = new CompensationRepository(tenantId);
          const success = await repo.deactivate(id);

          if (!success) {
               return customError('Failed to deactivate compensation record', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Compensation record deactivated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get all active compensations
 */
export const getAllActiveCompensationsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const status = req.query.status as string;

          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new CompensationRepository(tenantId);
          const compensations = await repo.getAll(status);

          res.json({
               status: 'success',
               statusCode: 200,
               result: compensations
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};
