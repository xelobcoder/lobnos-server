import { Request, Response } from 'express';
import { EntityOrderService } from '../../models/entityorders/EntityOrderService';
import { EntityOrderStatus } from '../../models/entityorders/EntityOrder.types';
import { EntityOrderListFilters } from '../../models/entityorders/EntityOrderRepository';
import { customError } from '../../hooks/helper';

const ENTITY_ORDER_STATUSES: string[] = ['DRAFT', 'PENDING', 'ON_HOLD', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'];

const getTenant = (req: Request): number => parseInt((req.query.tenantId as string) || (req.body?.tenantId as string) || '1', 10);
const getActor = (req: Request): number => parseInt((req.query.employeeid as string) || (req.body?.employeeid ?? req.body?.actorId ?? 0), 10);

function handle(res: Response, fn: () => Promise<void>) {
     fn().catch((err: any) => customError(err?.message || 'Something went wrong', 500, res));
}

/** POST /api/v1/entityorders  { patientId, orderedByEmployeeId, lines:[{testId,quantity}], consultationId?, sampleLocation?, notes? } */
export const createEntityOrderHandler = (req: Request, res: Response) => handle(res, async () => {
     const tenantId = getTenant(req);
     const svc = new EntityOrderService(tenantId);
     const order = await svc.createOrder({ ...req.body, orderedByEmployeeId: req.body.orderedByEmployeeId || getActor(req) });
     res.status(201).json({ status: 'success', statusCode: 201, message: 'Order created', data: order });
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (value: string) => DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

/**
 * Builds list filters from the query string. A clinician-portal session is always pinned to its own
 * clinician id (orders billed to them OR placed by them) so it can never read another clinician's orders.
 */
export function buildEntityOrderListFilters(query: any, authUser?: any): { filters?: EntityOrderListFilters; error?: string } {
     const { patientid, entityType, entityId, clinicianId, status, pendingReview, sampleLocation, consultationid, page, count, from, to } = query || {};
     for (const [name, value] of [['from', from], ['to', to]] as const) {
          if (value !== undefined && value !== '' && !isValidDate(String(value))) return { error: `${name} must be a date in YYYY-MM-DD format` };
     }
     if (from && to && String(from) > String(to)) return { error: 'from must be on or before to' };
     if (status && !ENTITY_ORDER_STATUSES.includes(status)) return { error: 'Invalid status' };

     const filters: EntityOrderListFilters = {
          patientId: patientid ? Number(patientid) : undefined,
          entityType: entityType || undefined,
          entityId: entityId ? Number(entityId) : undefined,
          clinicianId: clinicianId ? Number(clinicianId) : undefined,
          status: (status as EntityOrderStatus) || undefined,
          pendingReview: pendingReview === '1' || pendingReview === 'true',
          sampleLocation: (sampleLocation as 'center' | 'referrer') || undefined,
          consultationId: consultationid ? Number(consultationid) : undefined,
          from: from || undefined,
          to: to || undefined,
          page: page ? Number(page) : undefined,
          count: count ? Number(count) : undefined,
     };

     if (String(authUser?.role || '').toLowerCase() === 'clinician') {
          const selfId = Number(authUser.clinicianid ?? authUser.employeeid);
          if (!selfId) return { error: 'Clinician session could not be identified' };
          filters.clinicianId = selfId;
          filters.entityType = undefined;
          filters.entityId = undefined;
     }
     return { filters };
}

/** GET /api/v1/entityorders?patientid=&entityType=&entityId=&clinicianId=&status=&pendingReview=&consultationid=&from=&to= */
export const listEntityOrdersHandler = (req: Request, res: Response) => handle(res, async () => {
     const tenantId = getTenant(req);
     const { filters, error } = buildEntityOrderListFilters(req.query, (req as any).authUser);
     if (error || !filters) return customError(error || 'Invalid filters', 400, res);
     const svc = new EntityOrderService(tenantId);
     const data = await svc.listOrders(filters);
     res.status(200).json({
          status: 'success',
          statusCode: 200,
          result: data.result,
          total: data.total,
          page: data.page,
          count: data.count,
          totalPages: data.totalPages,
     });
});

/** GET /api/v1/entityorders/summary?clinicianId=&from=&to= — order counts/value per status for the same scope as the list. */
export const summarizeEntityOrdersHandler = (req: Request, res: Response) => handle(res, async () => {
     const tenantId = getTenant(req);
     const { filters, error } = buildEntityOrderListFilters(req.query, (req as any).authUser);
     if (error || !filters) return customError(error || 'Invalid filters', 400, res);
     const svc = new EntityOrderService(tenantId);
     const data = await svc.summarizeOrders(filters);
     res.status(200).json({ status: 'success', statusCode: 200, data });
});

/** GET /api/v1/entityorders/:id */
export const getEntityOrderHandler = (req: Request, res: Response) => handle(res, async () => {
     const tenantId = getTenant(req);
     const svc = new EntityOrderService(tenantId);
     const order = await svc.getOrder(Number(req.params.id));
     res.status(200).json({ status: 'success', statusCode: 200, data: order });
});

/** PUT /api/v1/entityorders/link-consultation  { orderIds: number[], patientId, consultationId } — backfills orders placed before a consultation was first saved. */
export const linkEntityOrdersToConsultationHandler = (req: Request, res: Response) => handle(res, async () => {
     const tenantId = getTenant(req);
     const { orderIds, patientId, consultationId } = req.body;
     if (!Array.isArray(orderIds) || !orderIds.length || !patientId || !consultationId) {
          return customError('orderIds, patientId and consultationId are required', 400, res);
     }
     const svc = new EntityOrderService(tenantId);
     const linked = await svc.linkOrdersToConsultation(orderIds.map(Number), Number(patientId), Number(consultationId));
     res.status(200).json({ status: 'success', statusCode: 200, message: 'Orders linked to consultation', linked });
});

const action = (
     res: Response,
     req: Request,
     fn: (svc: EntityOrderService, id: number, actor: number) => Promise<any>,
     message: string
) => handle(res, async () => {
     const tenantId = getTenant(req);
     const actorId = getActor(req);
     if (!actorId) return customError('employeeid (actor) is required', 400, res);
     const svc = new EntityOrderService(tenantId);
     const result = await fn(svc, Number(req.params.id), actorId);
     res.status(200).json({ status: 'success', statusCode: 200, message, data: result });
});

export const submitEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.submit(id, actor), 'Order submitted');

export const approveEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.approve(id, actor, req.body?.reason), 'Order approved');

export const holdEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.hold(id, actor, req.body?.reason), 'Order placed on hold');

export const rejectEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.reject(id, actor, req.body?.reason), 'Order rejected');

export const reviseEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.revise(id, actor, req.body?.lines), 'Order revised and resubmitted');

export const convertEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.convert(id, actor, req.body?.branchId ? Number(req.body.branchId) : null), 'Order converted to billing');

export const cancelEntityOrderHandler = (req: Request, res: Response) =>
     action(res, req, (svc, id, actor) => svc.cancel(id, actor, req.body?.reason), 'Order cancelled');
