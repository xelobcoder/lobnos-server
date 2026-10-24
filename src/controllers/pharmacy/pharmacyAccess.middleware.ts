import { NextFunction, Request, Response } from 'express';
import { PHARMACY_ACCESS_ROLES, PHARMACY_REVERSAL_ROLES } from '../../models/pharmacy/constants/pharmacy.constants';
import { roleOf, actorOf } from './pharmacyContext';
import { roleAllowed } from '../../middleware/roles';

const accessRoles = new Set<string>(PHARMACY_ACCESS_ROLES);
const reversalRoles = new Set<string>(PHARMACY_REVERSAL_ROLES);
export const pharmacyCatalogueAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), [...PHARMACY_ACCESS_ROLES, 'doctor', 'clinician', 'medical_officer', 'consultant'])) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy or prescribing access is required' } });
     next();
};

export const pharmacyAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), Array.from(accessRoles))) {
          return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy access is required' } });
     }
     next();
};


export const prescriptionListAccess = (request: Request, response: Response, next: NextFunction) => {
     if (roleAllowed(roleOf(request), Array.from(accessRoles))) return next();
     const requestedClinicianId = Number((request.query as any)?.clinicianId);
     const selfId = actorOf(request);
     if (roleAllowed(roleOf(request), ['doctor', 'clinician', 'medical_officer', 'consultant']) && requestedClinicianId && selfId && requestedClinicianId === selfId) return next();
     return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own drug orders' } });
};

/** Reversing a completed sale is a supervisory correction, deliberately out of a cashier's reach. */
export const pharmacyReversalAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), Array.from(reversalRoles))) {
          return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Reversing a sale requires a pharmacy manager or administrator' } });
     }
     next();
};

export const pharmacySalesAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), ['admin', 'pharmacy_manager', 'pharmacy_cashier', 'pharmacy_dispensary_officer','pharmacist'])) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy selling permission is required' } });
     next();
};
export const pharmacyStockAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), ['admin', 'pharmacy_manager', 'pharmacy_storekeeper'])) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy stock management permission is required' } });
     next();
};

export const pharmacyFinanceAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), ['admin', 'pharmacy_manager', 'pharmacy_accountant'])) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy financial permission is required' } });
     next();
};
export const pharmacyAdministratorAccess = (request: Request, response: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(request), ['admin'])) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only an organisation administrator may reopen a pharmacy financial day' } });
     next();
};
export const pharmacyShiftAccess = (request: Request, response: Response, next: NextFunction) => {
     if (roleAllowed(roleOf(request), ['pharmacy_accountant'])) return next();
     return pharmacySalesAccess(request, response, next);
};
