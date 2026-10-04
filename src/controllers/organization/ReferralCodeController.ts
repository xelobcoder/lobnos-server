import { NextFunction, Request, Response } from 'express';
import { ReferralCodingRepo } from '../../models/referral/repositories/ReferralCodingRepo';
import { getAuthUser } from '../../middleware/authority';

export class ReferralCodeController {
     static authorizeRead(request: Request, response: Response, next: NextFunction): void {
          const user = getAuthUser(request);
          if (!user) {
               response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required.' });
               return;
          }

          const role = user.role.toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
          const allowedRoles = new Set([
               'admin',
               'super admin',
               'superadmin',
               'manager',
               'accountant',
               'crm',
               'customer service representative',
               'customer representative',
               'front desk',
               'frontdesk',
          ]);
          if (!allowedRoles.has(role)) {
               response.status(403).json({ status: 'error', statusCode: 403, message: 'You do not have permission to view referral codes.' });
               return;
          }

          next();
     }

     static async list(request: Request, response: Response): Promise<void> {
          const tenantId = Number(request.query.tenantId);
          const page = Number(request.query.page ?? 1);
          const count = Number(request.query.count ?? 25);
          const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
          const requestedType = request.query.entityType;

          if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
               response.status(400).json({ status: 'error', statusCode: 400, message: 'A valid tenantId is required.' });
               return;
          }
          if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(count) || count < 1 || count > 100) {
               response.status(400).json({ status: 'error', statusCode: 400, message: 'page must be positive and count must be between 1 and 100.' });
               return;
          }
          if (requestedType !== undefined && requestedType !== 'organization' && requestedType !== 'clinician') {
               response.status(400).json({ status: 'error', statusCode: 400, message: 'entityType must be organization or clinician.' });
               return;
          }

          try {
               const result = await new ReferralCodingRepo(tenantId).getManagementPage({
                    page,
                    count,
                    search,
                    entityType: requestedType as 'organization' | 'clinician' | undefined,
               });
               response.json({ status: 'success', statusCode: 200, result });
          } catch (error) {
               console.error('Failed to list referral codes:', error);
               response.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to load referral codes.' });
          }
     }
}