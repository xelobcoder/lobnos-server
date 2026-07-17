import { Request, Response } from 'express';
import { BonusRepository, IBonus } from '../../models/payroll/AllowanceBonusRepository';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { customError } from '../../hooks/helper';
import { ZodError } from 'zod';

export const createBonusHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const bonusData: IBonus = req.body;
          const repo = new BonusRepository(tenantId);
          const id = await repo.create(bonusData);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Bonus created successfully',
               result: { id }
          });
     } catch (error) {
          if (error instanceof ZodError) {
               return customError(error.message, 400, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getBonusByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and bonus ID are required', 400, res);
          }

          const repo = new BonusRepository(tenantId);
          const bonus = await repo.getById(id);

          if (!bonus) {
               return customError('Bonus record not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: bonus
          });
     } catch (error) {
          if (error instanceof ZodError) {
               return customError(error.message, 400, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getBonusesByEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and employee ID are required', 400, res);
          }

          const repo = new BonusRepository(tenantId);
          const bonuses = await repo.getByEmployeeId(employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               result: bonuses
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const updateBonusHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and bonus ID are required', 400, res);
          }

          const repo = new BonusRepository(tenantId);
          const success = await repo.update(id, req.body);

          if (!success) {
               return customError('Failed to update bonus record', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Bonus updated successfully'
          });
     } catch (error) {
          if (error instanceof ZodError) {
               return customError(error.message, 400, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const deleteBonusHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and bonus ID are required', 400, res);
          }

          const repo = new BonusRepository(tenantId);
          const success = await repo.delete(id);

          if (!success) {
               return customError('Failed to delete bonus record', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Bonus deleted successfully'
          });
     } catch (error) {
          if (error instanceof ZodError) {
               return customError(error.message, 400, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};