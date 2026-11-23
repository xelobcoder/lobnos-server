import { Request, Response, Router } from 'express';
import { PatientPortalError } from '../../models/patient-portal/PatientPortalAccountService';
import { recordPortalAudit } from '../../models/patient-portal/PatientPortalAudit';
import { PublicAppointmentBooking } from '../../models/public/PublicAppointmentBooking';
import { requirePatientSession } from './route';
import { createRateLimiter } from '../../middleware/rateLimiter';
import logger from '../../hooks/logger';

const router = Router();
const base = '/api/v1/patient-portal/facilities/:slug/appointments';
const service = new PublicAppointmentBooking();
const bookingLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 30 });

function failure(res: Response, error: unknown) {
     if (error instanceof PatientPortalError) {
          return res.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, code: error.code, message: error.message });
     }
     // SQL error messages can include patient data, so do not log the error itself.
     logger.error('[PublicAppointmentBooking] Unexpected appointment service failure');
     return res.status(503).json({ status: 'error', statusCode: 503, message: 'Appointment service temporarily unavailable' });
}

router.use(base, (_req, res, next) => {
     res.setHeader('Cache-Control', 'private, no-store');
     res.setHeader('X-Content-Type-Options', 'nosniff');
     next();
});

router.get(`${base}/availability`, requirePatientSession, async (req: Request, res: Response) => {
     try {
          if (Object.keys(req.query).some(key => !['tenantId', 'date'].includes(key))) throw new PatientPortalError('Invalid query');
          const data = await service.availability(req.params.slug, (req as any).authUser.tenantId, req.query.date);
          return res.status(200).json({ status: 'success', statusCode: 200, message: 'success',
               data: { ...data, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
     } catch (error) { return failure(res, error); }
});

router.post(base, bookingLimiter, requirePatientSession, async (req: Request, res: Response) => {
     try {
          // A non-simple header is mandatory even if a browser also has a session cookie.
          if (typeof req.headers['pls-prime-tenant-session'] !== 'string' || !req.headers['pls-prime-tenant-session']) {
               return res.status(403).json({ status: 'error', statusCode: 403, message: 'A patient session header is required' });
          }
          if (Object.keys(req.query).some(key => key !== 'tenantId')) throw new PatientPortalError('Invalid query');
          const user = (req as any).authUser;
          const data = await service.book(req.params.slug, user.tenantId, user.patientid, req.body);
          await recordPortalAudit(user.tenantId, { patientid: user.patientid, actorType: 'patient', actorId: user.patientid,
               action: 'appointment.requested', resource: 'appointment', resourceId: data.refid, ipAddress: req.ip });
          return res.status(201).json({ status: 'success', statusCode: 201, message: 'Your appointment request has been sent to the facility.',
               data: { ...data, status: 'pending', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
     } catch (error) { return failure(res, error); }
});

export default router;
