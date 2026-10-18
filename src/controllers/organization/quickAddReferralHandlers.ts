import { Request, Response } from 'express';
import { customError } from '../../hooks/helper';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { normalizeQuickReferralEntity, QuickReferralEntityKind } from '../../models/referral/quickReferralEntity';
import { QuickReferralEntityService } from '../../models/referral/QuickReferralEntityService';
import { ClinicianOrganizationError } from '../../models/referral/ClinicianOrganizationService';

const quickAddHandler = (kind: QuickReferralEntityKind) =>
     async (request: Request<{}, {}, any, { tenantId?: string }>, response: Response) => {
          const tenantId = parseInt(String(request.query.tenantId ?? ''), 10);
          if (!Number.isSafeInteger(tenantId) || tenantId <= 0) return customError('tenantId is required', 400, response);

          const input = normalizeQuickReferralEntity(kind, request.body);
          if (input.error || !input.value) return customError(input.error || `Enter the ${kind} name`, 400, response);

          try {
               const service = new QuickReferralEntityService(tenantId);
               const result = kind === 'organization'
                    ? await service.createOrganization(input.value)
                    : await service.createClinician(input.value);
               const label = kind === 'organization' ? 'Organization' : 'Clinician';
               return response.status(result.created ? 201 : 200).send({
                    status: 'success',
                    statusCode: result.created ? 201 : 200,
                    message: result.created ? `${label} added` : `${label} already exists and has been selected`,
                    result,
               });
          } catch (error) {
               if (error instanceof ClinicianOrganizationError) return customError(error.message, error.statusCode, response);
               return PrimeSqlErrorHandler.handleError(error, response);
          }
     };

export const quickAddOrganizationHandler = quickAddHandler('organization');
export const quickAddClinicianHandler = quickAddHandler('clinician');
