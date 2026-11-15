import { NextFunction, Request, Response } from 'express';
import { customError } from '../hooks/helper';
import { getMasterSession } from '../models/Tenancy/MasterOwnerSession';

export async function requirePlatformFacilityAuthority(req: Request, res: Response, next: NextFunction) {
     try {
          const session = await getMasterSession(req.get('x-pls-master-session'));
          if (!session) return customError('Sign in with your master administrator account', 401, res);
          res.locals.facilityActor = { tenantId: 0, employeeId: session.employeeid };
          res.locals.platformOwnerClaims = session;
          next();
     } catch (error) {
          return customError('Unable to verify platform administrator access', 503, res);
     }
}
