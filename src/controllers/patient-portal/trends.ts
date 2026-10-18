import { NextFunction, Request, Response, Router } from 'express';
import { PatientPortalAccountService, PatientPortalError } from '../../models/patient-portal/PatientPortalAccountService';
import { PatientPortalTrendService } from '../../models/patient-portal/PatientPortalTrendService';
import { recordPortalAudit } from '../../models/patient-portal/PatientPortalAudit';

const positiveInt = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const identity = (req: Request) => (req as any).authUser;
const fail = (res: Response, error: unknown) => {
     if (error instanceof PatientPortalError) return res.status(error.statusCode).json({
          status: 'error', statusCode: error.statusCode, code: error.code, message: error.message,
     });
     // Do not log database errors or decrypted clinical data.
     return res.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to load test trends. Please try again later.' });
};

export async function requireTrendPatientSession(req: Request, res: Response, next: NextFunction) {
     res.setHeader('Cache-Control', 'no-store');
     const user = identity(req);
     if (user?.role !== 'patient' || !Number.isSafeInteger(user.patientid) || user.patientid <= 0 ||
          !Number.isSafeInteger(user.tenantId) || user.tenantId <= 0) {
          return res.status(403).json({ status: 'error', statusCode: 403, message: 'Patient portal access only' });
     }
     try {
          if (!await new PatientPortalAccountService(user.tenantId).isSessionValid(user.patientid, user.sessionVersion)) {
               return res.status(401).json({ status: 'error', statusCode: 401, code: 'SESSION_EXPIRED', isExpired: true, message: 'Session expired. Please sign in again.' });
          }
          return next();
     } catch (error) { return fail(res, error); }
}

export async function getTrendTests(req: Request, res: Response) {
     try {
          const user = identity(req);
          const data = await new PatientPortalTrendService(user.tenantId).listTests(user.patientid);
          await recordPortalAudit(user.tenantId, { patientid: user.patientid, actorType: 'patient', actorId: user.patientid, action: 'results.trends.list', resource: 'results', ipAddress: req.ip });
          return res.json({ status: 'success', statusCode: 200, data });
     } catch (error) { return fail(res, error); }
}

export async function getTrendHistory(req: Request, res: Response) {
     try {
          const testid = positiveInt(req.params.testid);
          const page = req.query.page === undefined ? 1 : positiveInt(req.query.page);
          const count = req.query.count === undefined ? 25 : positiveInt(req.query.count);
          if (!testid || !page || !count || count > 100) throw new PatientPortalError('Invalid test or pagination', 400);
          const user = identity(req);
          const data = await new PatientPortalTrendService(user.tenantId).history(user.patientid, testid, page, count);
          await recordPortalAudit(user.tenantId, { patientid: user.patientid, actorType: 'patient', actorId: user.patientid, action: 'results.trends.view', resource: 'test', resourceId: testid, ipAddress: req.ip });
          return res.json({ status: 'success', statusCode: 200, data });
     } catch (error) { return fail(res, error); }
}

/** Mount after the normal token/tenant middleware; never mount on public routes. */
export const patientPortalTrendsRouter = Router();
patientPortalTrendsRouter.get('/api/v1/patient-portal/trends/tests', requireTrendPatientSession, getTrendTests);
patientPortalTrendsRouter.get('/api/v1/patient-portal/trends/:testid', requireTrendPatientSession, getTrendHistory);
