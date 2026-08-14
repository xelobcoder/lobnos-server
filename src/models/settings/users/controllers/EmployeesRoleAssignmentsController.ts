import { Request, Response } from 'express';
import { EmployeesRoleAssignmentsRepository } from '../repositories';
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

export class EmployeesRoleAssignmentsController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRoleAssignmentsRepository(tenantId);
               await repo.create(req.body);
               return res.status(201).json({ status: 'success', statusCode: 201, message: 'Role assignment created successfully', result: req.body });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async listByEmployee(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRoleAssignmentsRepository(tenantId);
               const result = await repo.findByEmployeeId(parseEmployeeId(req));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Role assignments retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async listByRole(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRoleAssignmentsRepository(tenantId);
               const result = await repo.findByRoleId(parseId(req.params.roleId));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Role assignments retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async remove(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRoleAssignmentsRepository(tenantId);
               const affected = await repo.delete(parseId(req.params.employeeId), parseId(req.params.roleId));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Role assignment removed successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }
}

export default EmployeesRoleAssignmentsController;
