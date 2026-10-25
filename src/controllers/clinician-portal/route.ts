import { Request, Response, Router } from 'express';
import logger from '../../hooks/logger';
import {
     ClinicianPortalError, ClinicianPortalResultService, clinicianDateRange, resolveClinicianScope,
} from '../../models/clinician-portal/ClinicianPortalResultService';

const BASE = '/api/v1/clinician-portal';

const fail = (res: Response, error: unknown) => {
     if (error instanceof ClinicianPortalError) {
          return res.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, code: error.code, message: error.message });
     }
     logger.error('[ClinicianPortal]', (error as Error)?.message || error);
     return res.status(500).json({ status: 'error', statusCode: 500, message: 'Something went wrong. Please try again later.' });
};

/** The tenant comes from the verified session, never from a caller-controlled value alone. */
const tenantOf = (req: Request): number => {
     const tenantId = Number((req as any).authUser?.tenantId);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new ClinicianPortalError('Authentication required', 401, 'UNAUTHENTICATED');
     return tenantId;
};

const scopeActor=(req:any)=>req.practitioner?{...req.authUser,role:'clinician',clinicianid:req.practitioner.clinicianid}:req.authUser;
const branchOf=(req:any)=>req.practitioner?.branchid??req.authUser?.branch;
const single = (value: unknown) => Array.isArray(value) ? NaN : value;

export const clinicianPortalRouter = Router();

// Mounted after the global checkTokenExists middleware, which sets req.authUser from the JWT.
clinicianPortalRouter.get(`${BASE}/requests`, async (req: Request, res: Response) => {
     try {
          res.setHeader('Cache-Control', 'no-store');
          const clinicianid = resolveClinicianScope(scopeActor(req), single(req.query.clinicianid));
          const tenantId = tenantOf(req);
          const range = clinicianDateRange(req.query.from, req.query.to);
          const service=new ClinicianPortalResultService(tenantId),branch=branchOf(req);const result=branch==null?await service.listRequests(clinicianid,range.from,range.to):await service.listRequests(clinicianid,range.from,range.to,branch);
          return res.status(200).json({ status: 'success', statusCode: 200, message: 'success', result });
     } catch (error) { return fail(res, error); }
});

clinicianPortalRouter.get(`${BASE}/results/:billingid`, async (req: Request, res: Response) => {
     try {
          res.setHeader('Cache-Control', 'no-store');
          const clinicianid = resolveClinicianScope((req as any).authUser, single(req.query.clinicianid));
          const tenantId = tenantOf(req);
          const raw = String(req.params.billingid || '');
          const billingid = /^\d+$/.test(raw) ? Number(raw) : NaN;
          if (!Number.isSafeInteger(billingid) || billingid <= 0) throw new ClinicianPortalError('A valid billing id is required', 400);
          const service=new ClinicianPortalResultService(tenantId),branch=branchOf(req);const result=branch==null?await service.getRequestResults(clinicianid,billingid):await service.getRequestResults(clinicianid,billingid,branch);
          return res.status(200).json({ status: 'success', statusCode: 200, message: 'success', result });
     } catch (error) { return fail(res, error); }
});
