import { Request, Response, NextFunction } from 'express';
import { customError } from '../../../hooks/helper';
import { companyImageTenantId } from '../../../models/settings/companyImageStorage';
import { roleAllowed } from '../../../middleware/roles';

export function requireCompanyImageAdmin(request: Request, response: Response, next: NextFunction) {
     const user = (request as any).authUser;
     const tenantId = companyImageTenantId(request.query.tenantId);
     if (!user || tenantId === null || companyImageTenantId(user.tenantId) !== tenantId ||
          !roleAllowed(user.role, ['admin'])) {
          return customError('You do not have permission to update this company image', 403, response);
     }
     next();
}
