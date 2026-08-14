import { Request, Response } from 'express';

export const parseTenantId = (req: Request): number => {
     const tenantId = Number.parseInt(req.query.tenantId as string, 10);
     if (Number.isNaN(tenantId)) {
          throw new Error('Invalid tenantId');
     }
     return tenantId;
};

export const parseId = (value: string | string[] | number | undefined): number => {
     const normalizedValue = Array.isArray(value) ? value[0] ?? '' : value;
     const id = Number.parseInt(String(normalizedValue ?? ''), 10);
     if (Number.isNaN(id)) {
          throw new Error('Invalid id');
     }
     return id;
};

export const parseEmployeeId = (req: Request): number => {
     const rawEmployeeId = Array.isArray(req.params.employeeId)
          ? req.params.employeeId[0] ?? req.body.employeeId
          : req.params.employeeId ?? req.body.employeeId;

     const employeeId = Number.parseInt(String(rawEmployeeId ?? ''), 10);
     if (Number.isNaN(employeeId)) {
          throw new Error('Invalid employeeId');
     }
     return employeeId;
};

export const sendSuccess = (res: Response, statusCode: number, message: string, result?: any) => {
     return res.status(statusCode).json({
          status: 'success',
          statusCode,
          message,
          result,
     });
};
