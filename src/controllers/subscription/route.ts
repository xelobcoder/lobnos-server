import { NextFunction, Request, Response, Router } from 'express';
import { customError } from '../../hooks/helper';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { roleAllowed } from '../../middleware/roles';
import { FacilityError } from '../../models/Tenancy/FacilityInput';
import { FacilitySubscriptionTierService } from '../../models/Tenancy/FacilitySubscriptionTiers';
import type { FacilityActor } from '../../models/Tenancy/FacilityProvisioningService';

const router = Router();
const plans = new FacilitySubscriptionTierService();
const base = '/api/v1/subscription';

export function authorizeTenant(req: Request, res: Response, next: NextFunction) {
     const rawTenantId = req.query.tenantId;
     if (typeof rawTenantId !== 'string' || !/^[1-9]\d*$/.test(rawTenantId)) {
          return customError('A valid tenantId query parameter is required', 400, res);
     }
     const tenantId = Number(rawTenantId);
     const authUser = (req as any).authUser;
     if (!Number.isSafeInteger(tenantId) || !Number.isSafeInteger(Number(authUser?.tenantId)) ||
          Number(authUser.tenantId) !== tenantId) {
          return customError('The authenticated session does not match this tenant', 403, res);
     }
     if (!roleAllowed(authUser?.role, ['admin'])) {
          return customError('Only facility administrators may manage subscription plans', 403, res);
     }
     res.locals.subscriptionTenantId = tenantId;
     next();
}

const handle = (operation: (req: Request, res: Response) => Promise<unknown>) =>
     async (req: Request, res: Response) => {
          try {
               const result = await operation(req, res);
               return res.json({ status: 'success', result });
          } catch (error: any) {
               if (error instanceof FacilityError) return customError(error.message, error.statusCode, res);
               return customError('Subscription plan service is temporarily unavailable', 503, res);
          }
     };

router.use(base, checkTokenExists, authorizeTenant);
router.get(`${base}/plan`, handle(req => plans.tenantPlanView(resTenantId(req))));
router.get(`${base}/upgrade-requests`, handle(req => plans.tenantUpgradeRequests(resTenantId(req))));
router.post(`${base}/upgrade-requests`, handle((req, res) => {
     if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          typeof req.body.planCode !== 'string') {
          throw new FacilityError('planCode is required');
     }
     const user = (req as any).authUser;
     const actor: FacilityActor = { tenantId: resTenantId(req), employeeId: Number(user.employeeid) };
     return plans.createUpgradeRequest(actor.tenantId, req.body.planCode, user.email, actor);
}));

function resTenantId(req: Request): number {
     return Number((req as any).authUser.tenantId);
}

export default router;
