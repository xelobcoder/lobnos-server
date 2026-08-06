import { Request, Response } from 'express';
import { AllowanceRepository, IAllowance } from '../../models/payroll/AllowanceBonusRepository';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { customError } from '../../hooks/helper';
import { ZodError } from 'zod';

const ALLOWANCE_TYPES: Array<IAllowance['allowance_type']> = [
     'housing',
     'transport',
     'meal',
     'medical',
     'education',
     'uniform',
     'mobile',
     'hazard',
     'shift_allowance',
     'professional_development',
     'internet',
     'utility',
     'fuel',
     'risk',
     'hardship',
     'acting',
     'responsibility',
     'entertainment',
     'other'
];

export const createAllowanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const allowanceData: IAllowance = req.body;
          const repo = new AllowanceRepository(tenantId);
          const id = await repo.create(allowanceData);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Allowance created successfully',
               result: { id }
          });
     } catch (error) {
          if (error instanceof ZodError) {
               return customError(error.message, 400, res);
          }
console.log(error)
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllowanceByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and allowance ID are required', 400, res);
          }

          const repo = new AllowanceRepository(tenantId);
          const allowance = await repo.getById(id);

          if (!allowance) {
               return customError('Allowance record not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: allowance
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllowancesByEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid.toString());

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and employee ID are required', 400, res);
          }

          const repo = new AllowanceRepository(tenantId);
          const allowances = await repo.getByEmployeeId(employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               result: allowances
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getActiveAllowancesByEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid.toString());

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and employee ID are required', 400, res);
          }

          const repo = new AllowanceRepository(tenantId);
          const allowances = await repo.getActiveByEmployeeId(employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               result: allowances
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const updateAllowanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and allowance ID are required', 400, res);
          }

          const repo = new AllowanceRepository(tenantId);
          const success = await repo.update(id, req.body);

          if (!success) {
               return customError('Failed to update allowance record', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Allowance updated successfully'
          });
     } catch (error) {
          if (error instanceof ZodError) {
               return customError(error.message, 400, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const deactivateAllowanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and allowance ID are required', 400, res);
          }

          const repo = new AllowanceRepository(tenantId);
          const success = await repo.deactivate(id);

          if (!success) {
               return customError('Failed to deactivate allowance record', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Allowance deactivated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllActiveAllowancesHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new AllowanceRepository(tenantId);
          const allowances = await repo.getAllActive();

          res.json({
               status: 'success',
               statusCode: 200,
               result: allowances
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllowanceTypesHandler = async (_req: Request, res: Response) => {
     res.json({
          status: 'success',
          statusCode: 200,
          result: ALLOWANCE_TYPES
     });
};
