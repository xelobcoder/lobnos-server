import { NextFunction, Request, Response } from 'express';
import { parseTenantId } from '../models/application/email/helpers/parseTenantId';
import { isEmailModuleActivated } from '../models/application/email/helpers/emailModuleActivation';

export async function emailModuleMiddleware(req: Request, res: Response, next: NextFunction) {
     try {
          const tenantId = parseTenantId(req.query.tenantId ?? req.query.tenant);
          const enabled = await isEmailModuleActivated(tenantId);

          if (!enabled) {
               return res.status(403).send({
                    status: 'error',
                    statusCode: 403,
                    message: 'Email module is not activated.',
               });
          }

          next();
     } catch (error) {
          return res.status(400).send({
               status: 'error',
               statusCode: 400,
               message: error instanceof Error ? error.message : 'Unable to validate email module activation.',
          });
     }
}
