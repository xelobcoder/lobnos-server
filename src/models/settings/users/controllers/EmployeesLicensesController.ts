import { Request, Response } from 'express';
import { EmployeesLicensesRepository } from '../repositories';
import { PrimeSqlErrorHandler } from '../../../../hooks/utility';

const parseTenantId = (req: Request): number => {
     const tenantId = Number.parseInt(req.query.tenantId as string, 10);
     if (Number.isNaN(tenantId)) throw new Error('Invalid tenantId');
     return tenantId;
};

const parseId = (value: string | string[] | number | undefined): number => {
     const normalizedValue = Array.isArray(value) ? value[0] ?? '' : value;
     const id = Number.parseInt(String(normalizedValue ?? ''), 10);
     if (Number.isNaN(id)) throw new Error('Invalid id');
     return id;
};

const parseEmployeeId = (req: Request): number => {
     const rawEmployeeId = Array.isArray(req.params.employeeId)
          ? req.params.employeeId[0] ?? req.body.employeeId
          : req.params.employeeId ?? req.body.employeeId;
     const employeeId = Number.parseInt(String(rawEmployeeId ?? ''), 10);
     return employeeId;
};

export class EmployeesLicensesController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesLicensesRepository(tenantId);
               const id = await repo.create(req.body);
               return res.status(201).json({ status: 'success', statusCode: 201, message: 'License created successfully', result: { id } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async listByEmployee(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesLicensesRepository(tenantId);
               const result = await repo.findByEmployeeId(parseEmployeeId(req));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Licenses retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async getById(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesLicensesRepository(tenantId);
               const result = await repo.findById(parseId(req.params.id));
               if (!result) {
                    return res.status(404).json({ status: 'error', statusCode: 404, message: 'License not found' });
               }
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'License retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async update(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesLicensesRepository(tenantId);
               const affected = await repo.update(parseId(req.params.id), req.body);
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'License updated successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async remove(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesLicensesRepository(tenantId);
               const affected = await repo.delete(parseId(req.params.id));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'License deleted successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }
}

export default EmployeesLicensesController;
