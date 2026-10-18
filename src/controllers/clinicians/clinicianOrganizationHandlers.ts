import { Request, Response } from 'express';
import { customError } from '../../hooks/helper';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { ClinicianOrganizationError, ClinicianOrganizationService, parsePositiveId } from '../../models/referral/ClinicianOrganizationService';

type AffiliationRequest = Request<{ clinicianId?: string; organizationId?: string }, any, any, { tenantId?: string }>;

function context(request: AffiliationRequest, response: Response) {
     const tenantId = parsePositiveId(request.query.tenantId);
     if (!tenantId) { customError('tenantId is required', 400, response); return null; }
     const clinicianId = parsePositiveId(request.params.clinicianId);
     if (!clinicianId) { customError('A valid clinician id is required', 400, response); return null; }
     return { service: new ClinicianOrganizationService(tenantId), clinicianId };
}

function fail(error: unknown, response: Response) {
     if (error instanceof ClinicianOrganizationError) return customError(error.message, error.statusCode, response);
     return PrimeSqlErrorHandler.handleError(error, response);
}

/** GET /api/v1/clinicians/:clinicianId/organizations */
export async function listClinicianOrganizationsHandler(request: AffiliationRequest, response: Response) {
     const ctx = context(request, response);
     if (!ctx) return;
     try {
          const result = await ctx.service.list(ctx.clinicianId);
          return response.status(200).send({ status: 'success', statusCode: 200, message: 'Clinician organizations', result });
     } catch (error) {
          return fail(error, response);
     }
}

/** POST /api/v1/clinicians/:clinicianId/organizations { organizationId } */
export async function linkClinicianOrganizationHandler(request: AffiliationRequest, response: Response) {
     const ctx = context(request, response);
     if (!ctx) return;
     const organizationId = parsePositiveId(request.body?.organizationId);
     if (!organizationId) return customError('A valid organization id is required', 400, response);
     try {
          const { created, organizations } = await ctx.service.link(ctx.clinicianId, organizationId);
          return response.status(created ? 201 : 200).send({
               status: 'success',
               statusCode: created ? 201 : 200,
               message: created ? 'Organization linked to clinician' : 'Clinician is already linked to this organization',
               result: organizations,
          });
     } catch (error) {
          return fail(error, response);
     }
}

/** DELETE /api/v1/clinicians/:clinicianId/organizations/:organizationId */
export async function unlinkClinicianOrganizationHandler(request: AffiliationRequest, response: Response) {
     const ctx = context(request, response);
     if (!ctx) return;
     const organizationId = parsePositiveId(request.params.organizationId);
     if (!organizationId) return customError('A valid organization id is required', 400, response);
     try {
          const result = await ctx.service.unlink(ctx.clinicianId, organizationId);
          return response.status(200).send({ status: 'success', statusCode: 200, message: 'Organization removed from clinician', result });
     } catch (error) {
          return fail(error, response);
     }
}
