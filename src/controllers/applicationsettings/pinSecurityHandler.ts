import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { StaffPinSecurity, StaffPinSecurityError } from '../../models/security/StaffPinSecurity';
import { customError } from '../../hooks/helper';

function positiveInteger(value: unknown): number | null {
     if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
     const number = Number(value);
     return Number.isSafeInteger(number) ? number : null;
}

function context(req: Request) {
     const actor = getAuthUser(req);
     if (!actor) throw new StaffPinSecurityError('Authentication required', 401);
     const tenantId = positiveInteger(req.query.tenantId);
     if (!tenantId || tenantId !== actor.tenantId) throw new StaffPinSecurityError('Invalid tenantId', 400);
     return { actor, service: new StaffPinSecurity(actor.tenantId) };
}

function handleError(error: unknown, res: Response) {
     return error instanceof StaffPinSecurityError
          ? customError(error.message, error.statusCode, res)
          : customError('Unable to manage PIN security', 500, res);
}

export async function getPinSecurityPolicy(req: Request, res: Response) {
     try {
          const { service } = context(req);
          return res.status(200).json({ status: 'success', statusCode: 200, result: await service.policy() });
     } catch (error) { return handleError(error, res); }
}

export async function updatePinSecurityPolicy(req: Request, res: Response) {
     try {
          const { actor, service } = context(req);
          const result = await service.updatePolicy(actor, req.body?.pinAttemptLimit, req.body?.reason);
          return res.status(200).json({ status: 'success', statusCode: 200, result });
     } catch (error) { return handleError(error, res); }
}

export async function listStaffPinSecurity(req: Request, res: Response) {
     try {
          const { actor, service } = context(req);
          const page = positiveInteger(req.query.page ?? '1');
          const count = positiveInteger(req.query.count ?? '20');
          if (!page || !count || count > 100 || !Number.isSafeInteger((page - 1) * count)) {
               throw new StaffPinSecurityError('Invalid page or count (maximum 100)', 400);
          }
          const result = await service.list(actor, page, count);
          return res.status(200).json({ status: 'success', statusCode: 200, result, page, count });
     } catch (error) { return handleError(error, res); }
}

export async function resetStaffPinAttempts(req: Request, res: Response) {
     try {
          const { actor, service } = context(req);
          const employeeid = positiveInteger(req.params.employeeid);
          if (!employeeid) throw new StaffPinSecurityError('Invalid employeeid', 400);
          const result = await service.reset(actor, employeeid, req.body?.reason);
          return res.status(200).json({ status: 'success', statusCode: 200, message: 'PIN attempts reset. The PIN has not changed.', result });
     } catch (error) { return handleError(error, res); }
}
