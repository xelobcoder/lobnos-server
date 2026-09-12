import { Request, Response } from 'express';
import { EntityOrderService } from '../../models/entityorders/EntityOrderService';
import { EntityOrderStatus } from '../../models/entityorders/EntityOrder.types';
import { customError } from '../../hooks/helper';

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

/** GET /api/v1/entityorders?patientid=&entityType=&entityId=&status=&pendingReview=&consultationid= */
export const listEntityOrdersHandler = (req: Request, res: Response) => handle(res, async () => {
     const tenantId = getTenant(req);
     const { patientid, entityType, entityId, status, pendingReview, sampleLocation, consultationid, page, count } = req.query as any;
     const svc = new EntityOrderService(tenantId);
     const data = await svc.listOrders({
          patientId: patientid ? Number(patientid) : undefined,
          entityType: entityType || undefined,
          entityId: entityId ? Number(entityId) : undefined,
          status: (status as EntityOrderStatus) || undefined,
          pendingReview: pendingReview === '1' || pendingReview === 'true',
          sampleLocation: (sampleLocation as 'center' | 'referrer') || undefined,
          consultationId: consultationid ? Number(consultationid) : undefined,
          page: page ? Number(page) : undefined,
          count: count ? Number(count) : undefined,
     });
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
