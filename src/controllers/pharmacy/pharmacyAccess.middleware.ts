import { NextFunction, Request, Response } from 'express';
import { PHARMACY_ACCESS_ROLES, PHARMACY_REVERSAL_ROLES } from '../../models/pharmacy/constants/pharmacy.constants';
import { roleOf } from './pharmacyContext';

const accessRoles = new Set<string>(PHARMACY_ACCESS_ROLES);
const reversalRoles = new Set<string>(PHARMACY_REVERSAL_ROLES);

export const pharmacyAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!accessRoles.has(roleOf(request))) {
          return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy access is required' } });
     }
     next();
};

/** Reversing a completed sale is a supervisory correction, deliberately out of a cashier's reach. */
export const pharmacyReversalAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!reversalRoles.has(roleOf(request))) {
          return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Reversing a sale requires a pharmacy manager or administrator' } });
     }
     next();
};
