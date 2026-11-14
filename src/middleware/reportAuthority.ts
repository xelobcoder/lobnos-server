import { NextFunction, Request, Response } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed } from './roles';

/** Reporting reads billing, clinical turnaround and stock data, so it follows the accounting role boundary. */
export const REPORT_ROLES = ['admin', 'accountant'];

export const requireReportAccess = (request: Request, response: Response, next: NextFunction) => {
     const user = getAuthUser(request);
     if (!user) return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required' });
     if (!roleAllowed(user.role, REPORT_ROLES)) {
          return response.status(403).json({ status: 'error', statusCode: 403, message: 'Your role cannot access reports.' });
     }
     return next();
};
