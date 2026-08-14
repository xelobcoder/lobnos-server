import { Request, Response } from 'express';
import { EmployeesRolePermissionsRepository } from '../repositories';
import { PrimeSqlErrorHandler } from '../../../../hooks/utility';
import { parseId, parseTenantId, sendSuccess } from './employeeSettingsControllerUtils';

export class EmployeesRolePermissionsController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRolePermissionsRepository(tenantId);
               await repo.create(req.body);
               return res.status(201).json({ status: 'success', statusCode: 201, message: 'Role permission created successfully', result: req.body });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async listByRole(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRolePermissionsRepository(tenantId);
               const result = await repo.findByRoleId(parseId(req.params.roleId));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Role permissions retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async remove(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesRolePermissionsRepository(tenantId);
               const affected = await repo.delete(parseId(req.params.roleId), parseId(req.params.permissionId));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Role permission removed successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }
}

export default EmployeesRolePermissionsController;
