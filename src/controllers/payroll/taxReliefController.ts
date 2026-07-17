import { Request, Response } from 'express';
import { customError } from '../../hooks/helper';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { TaxReliefRepository, ITaxRelief } from '../../models/payroll/TaxReliefRepository';

export const createTaxReliefHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const relief: ITaxRelief = req.body;
          const repo = new TaxReliefRepository(tenantId);
          const id = await repo.create(relief);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Tax relief created successfully',
               result: { id }
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllTaxReliefsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const activeOnly = req.query.activeOnly !== 'false';
          const repo = new TaxReliefRepository(tenantId);
          const reliefs = await repo.getAll(activeOnly);

          res.json({
               status: 'success',
               statusCode: 200,
               result: reliefs
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getTaxReliefByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and tax relief ID are required', 400, res);
          }

          const repo = new TaxReliefRepository(tenantId);
          const relief = await repo.getById(id);

          if (!relief) {
               return customError('Tax relief not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: relief
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const updateTaxReliefHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and tax relief ID are required', 400, res);
          }

          const repo = new TaxReliefRepository(tenantId);
          const success = await repo.update(id, req.body);

          if (!success) {
               return customError('Failed to update tax relief', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax relief updated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const deactivateTaxReliefHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and tax relief ID are required', 400, res);
          }

          const repo = new TaxReliefRepository(tenantId);
          const success = await repo.deactivate(id);

          if (!success) {
               return customError('Failed to deactivate tax relief', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Tax relief deactivated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};