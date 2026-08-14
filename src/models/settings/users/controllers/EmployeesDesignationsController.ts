import { Request, Response } from 'express';
import { EmployeesDesignationsRepository } from '../repositories';
import { PrimeSqlErrorHandler } from '../../../../hooks/utility';
import { parseId, parseTenantId, sendSuccess } from './employeeSettingsControllerUtils';

export class EmployeesDesignationsController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDesignationsRepository(tenantId);
               const id = await repo.create(req.body);
               return res.status(201).json({ status: 'success', statusCode: 201, message: 'Designation created successfully', result: { id } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async list(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDesignationsRepository(tenantId);
               const result = await repo.findAll();
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Designations retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async getById(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDesignationsRepository(tenantId);
               const result = await repo.findById(parseId(req.params.id));
               if (!result) {
                    return res.status(404).json({ status: 'error', statusCode: 404, message: 'Designation not found' });
               }
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Designation retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async update(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDesignationsRepository(tenantId);
               const affected = await repo.update(parseId(req.params.id), req.body);
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Designation updated successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async remove(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDesignationsRepository(tenantId);
               const affected = await repo.delete(parseId(req.params.id));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Designation deleted successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }
}

export default EmployeesDesignationsController;
