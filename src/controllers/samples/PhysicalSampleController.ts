import { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { PhysicalSampleService, PhysicalSampleStatus } from '../../models/samples/PhysicalSampleService';
import { PhysicalSampleCommunicationService } from '../../models/samples/PhysicalSampleCommunicationService';
import { roleAllowed } from '../../middleware/roles';

const ALLOWED_ROLES = ['admin', 'manager', 'scientist', 'phelobotomist', 'phlebotomist'];

export function requireSampleCollectionRole(request: Request, response: Response, next: NextFunction) {
     const actor = getAuthUser(request);
     if (!actor) return response.status(401).json({ success: false, message: 'Authentication required' });
     if (!roleAllowed(actor.role, ALLOWED_ROLES)) return response.status(403).json({ success: false, message: 'You are not authorized to manage physical samples' });
     return next();
}

export class PhysicalSampleController {
     static async worklist(request: Request, response: Response): Promise<void> {
          await PhysicalSampleController.respondWithReport(request, response, 'samples');
     }

     static async reviewWorklist(request: Request, response: Response): Promise<void> {
          await PhysicalSampleController.respondWithReport(request, response, 'reviews');
     }

     static async communicationWorklist(request: Request, response: Response): Promise<void> {
          await PhysicalSampleController.respondWithReport(request, response, 'communications');
     }

     static async auditDetail(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               response.json({ success: true, data: await new PhysicalSampleService(actor.tenantId).auditDetail(Number(request.params.id)) });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 400).json({ success: false, message: error.message || 'Unable to load sample audit history' });
          }
     }

     static async candidates(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const billingid = Number(request.query.billingid);
               if (!Number.isInteger(billingid) || billingid <= 0) {
                    response.status(400).json({ success: false, message: 'Valid billing ID is required' });
                    return;
               }
               response.json({ success: true, data: await new PhysicalSampleService(actor.tenantId).candidates(billingid) });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to load sample candidates' });
          }
     }

     static async collectionConsentMode(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const billingid = Number(request.query.billingid);
               if (!Number.isInteger(billingid) || billingid <= 0) {
                    response.status(400).json({ success: false, message: 'Valid billing ID is required' });
                    return;
               }
               const mode = await new PhysicalSampleService(actor.tenantId).collectionConsentMode(billingid, actor.branch);
               response.json({ success: true, data: { mode } });
          } catch (error: any) {
               response.status(error.statusCode || 500).json({
                    success: false,
                    message: error.statusCode ? error.message : 'Unable to load collection consent settings',
               });
          }
     }

     static async create(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const sample = await new PhysicalSampleService(actor.tenantId).create({
                    consent: request.body?.consent,
                    billingid: Number(request.body?.billingid),
                    ascensionIds: request.body?.ascensionIds || request.body?.ascension_ids || [],
                    action: request.body?.action,
                    quantity: request.body?.quantity,
                    unit: request.body?.unit,
                    notes: request.body?.notes,
                    externalFacility: request.body?.externalFacility || request.body?.external_facility,
                    collectionCenterId: request.body?.collectionCenterId,
                    collectionBranchId: actor.branch,
                    idempotencyKey: request.body?.idempotencyKey || request.body?.idempotency_key,
                    allowAdditional: Boolean(request.body?.allowAdditional || request.body?.allow_additional),
               }, actor.employeeid);
               response.status(201).json({ success: true, data: sample });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /already|different|belong/i.test(error.message) ? 409 : 400;
               response.status(status).json({ success: false, message: error.message || 'Unable to create physical sample' });
          }
     }

     static async transition(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const status = request.body?.status as PhysicalSampleStatus;
               const validationRoles = ['admin', 'manager', 'scientist'];
               const receptionRoles = [...validationRoles, 'phelobotomist', 'phlebotomist'];
               if (['accepted', 'rejected'].includes(status) && !roleAllowed(actor.role, validationRoles)) {
                    response.status(403).json({ success: false, message: 'Only an authorized scientist may validate a sample' });
                    return;
               }
               if (status === 'received' && !roleAllowed(actor.role, receptionRoles)) {
                    response.status(403).json({ success: false, message: 'You are not authorized to receive samples' });
                    return;
               }
               const sample = await new PhysicalSampleService(actor.tenantId).transition(
                    Number(request.params.id),
                    status,
                    actor.employeeid,
                    request.body?.reason,
                    {
                         consent: request.body?.consent,
                         expectedVersion: request.body?.expectedVersion ?? request.body?.expected_version,
                         idempotencyKey: request.body?.idempotencyKey ?? request.body?.idempotency_key,
                         communication: request.body?.communication,
                         collectionCenterId: request.body?.collectionCenterId,
                         collectionBranchId: actor.branch,
                    }
               );
               response.json({ success: true, data: sample });
               if (sample.communicationId) new PhysicalSampleCommunicationService(actor.tenantId).dispatch(sample.communicationId).catch(() => { });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /reason|required|unsupported/i.test(error.message) ? 400 : 409;
               response.status(status).json({ success: false, message: error.message || 'Unable to update physical sample' });
          }
     }

     static async requestReview(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const review = await new PhysicalSampleService(actor.tenantId).requestReview(Number(request.params.id), actor.employeeid, request.body?.reason);
               response.status(201).json({ success: true, data: review });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 409).json({ success: false, message: error.message });
          }
     }

     static async receiveMany(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const result = await new PhysicalSampleService(actor.tenantId).receiveMany(request.body?.samples || [], actor.employeeid);
               response.json({ success: true, data: result });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : /changed|only collected/i.test(error.message) ? 409 : 400).json({ success: false, message: error.message });
          }
     }

     static async decideReview(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               if (!roleAllowed(actor.role, ['admin', 'manager', 'scientist'])) {
                    response.status(403).json({ success: false, message: 'Only an authorized scientist may decide a sample review' });
                    return;
               }
               const result = await new PhysicalSampleService(actor.tenantId).decideReview(Number(request.params.reviewId), actor.employeeid, request.body?.decision, request.body?.notes);
               response.json({ success: true, data: result });
          } catch (error: any) {
               const status = /different scientist/i.test(error.message) ? 403 : /not found/i.test(error.message) ? 404 : 409;
               response.status(status).json({ success: false, message: error.message });
          }
     }

     static async communications(request: Request, response: Response): Promise<void> {
          const actor = getAuthUser(request)!;
          response.json({ success: true, data: await new PhysicalSampleCommunicationService(actor.tenantId).list(Number(request.params.id)) });
     }

     static async byAscension(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const sample = await new PhysicalSampleService(actor.tenantId).findByAscension(Number(request.params.ascensionId));
               const communications = await new PhysicalSampleCommunicationService(actor.tenantId).list(Number(sample.id));
               response.json({ success: true, data: { ...sample, communications } });
          } catch (error: any) {
               response.status(/not found|no physical/i.test(error.message) ? 404 : 400).json({ success: false, message: error.message });
          }
     }

     static async recollect(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const data = await new PhysicalSampleService(actor.tenantId).recollect(
                    Number(request.params.id), actor.employeeid, request.body?.collectionCenterId, actor.branch,
               );
               response.status(201).json({ success: true, data });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 409).json({ success: false, message: error.message });
          }
     }

     static async detail(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               response.json({ success: true, data: await new PhysicalSampleService(actor.tenantId).detail(Number(request.params.id)) });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 400).json({ success: false, message: error.message });
          }
     }

     static async barcode(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const connection = await (await import('../../database/KnexConnections')).default(actor.tenantId);
               const lookup = String(request.params.barcode).trim();
               const row = await connection('physical_samples')
                    .where('barcode', lookup)
                    .orWhere('sample_uid', lookup)
                    .modify((builder: any) => {
                         if (/^\d+$/.test(lookup)) builder.orWhere('id', Number(lookup));
                    })
                    .first();
               if (!row) {
                    response.status(404).json({ success: false, message: 'Physical sample not found' });
                    return;
               }
               response.json({ success: true, data: await new PhysicalSampleService(actor.tenantId).detail(Number(row.id)) });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to find sample' });
          }
     }

     private static async respondWithReport(request: Request, response: Response, report: 'samples' | 'reviews' | 'communications'): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const rawCenter = report === 'samples' ? request.query.collectionCenterId : undefined;
               const centerId = typeof rawCenter === 'string' && /^\d+$/.test(rawCenter) ? Number(rawCenter) : NaN;
               if (rawCenter !== undefined && (!Number.isSafeInteger(centerId) || centerId < 1)) {
                    response.status(400).json({ success: false, message: 'Select a valid collection center' });
                    return;
               }
               const filters = {
                    startDate: request.query.startDate as string | undefined,
                    endDate: request.query.endDate as string | undefined,
                    status: request.query.status as string | undefined,
                    search: request.query.search as string | undefined,
                    collectionCenterId: rawCenter === undefined ? undefined : centerId,
                    page: Number(request.query.page || 1),
                    count: Number(request.query.count || 10),
               };
               const service = new PhysicalSampleService(actor.tenantId);
               const data = report === 'samples' ? await service.worklist(filters) : report === 'reviews' ? await service.reviewWorklist(filters) : await service.communicationWorklist(filters);
               response.json({ success: true, data });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to load physical sample report' });
          }
     }
}
