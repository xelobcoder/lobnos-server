import { beforeEach, describe, expect, it, vi } from 'vitest';

const svc = {
     filterOrderIdsForClinician: vi.fn(),
     getOrder: vi.fn(),
     submit: vi.fn(),
     cancel: vi.fn(),
     approve: vi.fn(),
     createOrder: vi.fn(),
     linkOrdersToConsultation: vi.fn(),
};

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(), KnexConnection: vi.fn() }));
vi.mock('../../models/entityorders/EntityOrderService', () => ({
     EntityOrderService: vi.fn().mockImplementation(function () { return svc; }),
}));

import {
     approveEntityOrderHandler,
     cancelEntityOrderHandler,
     createEntityOrderHandler,
     getEntityOrderHandler,
     linkEntityOrdersToConsultationHandler,
     submitEntityOrderHandler,
} from './entityOrdersHandlers';

const clinician = { role: 'clinician', clinicianid: 7, employeeid: 7, tenantId: 1 };
const staff = { role: 'admin', employeeid: 3, tenantId: 1 };

function makeRes() {
     const res: any = { statusCode: 0, body: undefined };
     res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
     res.json = vi.fn((body: any) => { res.body = body; return res; });
     res.send = vi.fn((body: any) => { res.body = body; return res; });
     return res;
}

async function run(handler: any, req: any) {
     const res = makeRes();
     handler({ query: { tenantId: '1' }, body: {}, params: {}, ...req }, res);
     for (let i = 0; i < 10 && !res.statusCode; i++) await new Promise((r) => setImmediate(r));
     return res;
}

beforeEach(() => {
     Object.values(svc).forEach((fn) => fn.mockReset());
     svc.getOrder.mockResolvedValue({ id: 5 });
     svc.submit.mockResolvedValue({ id: 5, status: 'PENDING' });
     svc.cancel.mockResolvedValue({ id: 5, status: 'CANCELLED' });
     svc.approve.mockResolvedValue({ id: 5, status: 'APPROVED' });
     svc.createOrder.mockResolvedValue({ id: 9 });
     svc.linkOrdersToConsultation.mockResolvedValue(1);
});

describe('entity order per-order scoping', () => {
     it('returns 404 when a clinician reads another clinician\'s order', async () => {
          svc.filterOrderIdsForClinician.mockResolvedValue([]);
          const res = await run(getEntityOrderHandler, { params: { id: '5' }, authUser: clinician });
          expect(res.statusCode).toBe(404);
          expect(svc.filterOrderIdsForClinician).toHaveBeenCalledWith([5], 7);
          expect(svc.getOrder).not.toHaveBeenCalled();
     });

     it('returns the order when the clinician owns it', async () => {
          svc.filterOrderIdsForClinician.mockResolvedValue([5]);
          const res = await run(getEntityOrderHandler, { params: { id: '5' }, authUser: clinician });
          expect(res.statusCode).toBe(200);
          expect(res.body.data).toEqual({ id: 5 });
     });

     it('does not scope staff sessions', async () => {
          const res = await run(getEntityOrderHandler, { params: { id: '5' }, authUser: staff });
          expect(res.statusCode).toBe(200);
          expect(svc.filterOrderIdsForClinician).not.toHaveBeenCalled();
     });

     it.each([
          ['submit', submitEntityOrderHandler, 'submit'],
          ['cancel', cancelEntityOrderHandler, 'cancel'],
          ['approve', approveEntityOrderHandler, 'approve'],
     ] as const)('blocks %s on an unowned order with 404', async (_name, handler, method) => {
          svc.filterOrderIdsForClinician.mockResolvedValue([]);
          const res = await run(handler, { params: { id: '5' }, body: { employeeid: 99 }, authUser: clinician });
          expect(res.statusCode).toBe(404);
          expect((svc as any)[method]).not.toHaveBeenCalled();
     });

     it('acts as the clinician, ignoring a spoofed body actor', async () => {
          svc.filterOrderIdsForClinician.mockResolvedValue([5]);
          const res = await run(submitEntityOrderHandler, { params: { id: '5' }, body: { employeeid: 99 }, authUser: clinician });
          expect(res.statusCode).toBe(200);
          expect(svc.submit).toHaveBeenCalledWith(5, 7);
     });

     it('rejects linking orders the clinician does not own', async () => {
          svc.filterOrderIdsForClinician.mockResolvedValue([5]);
          const res = await run(linkEntityOrdersToConsultationHandler, {
               body: { orderIds: [5, 6], patientId: 1, consultationId: 2 },
               authUser: clinician,
          });
          expect(res.statusCode).toBe(404);
          expect(svc.linkOrdersToConsultation).not.toHaveBeenCalled();
     });

     it('creates orders as the clinician session', async () => {
          const res = await run(createEntityOrderHandler, {
               body: { patientId: 1, orderedByEmployeeId: 99, lines: [{ testId: 1 }] },
               authUser: clinician,
          });
          expect(res.statusCode).toBe(201);
          expect(svc.createOrder).toHaveBeenCalledWith(expect.objectContaining({ orderedByEmployeeId: 7 }));
     });
});
