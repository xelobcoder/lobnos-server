import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../database/KnexConnections';
import { requireRefundActor } from './refundAuthority';

describe('refund document and actor boundary', () => {
    let document: any;
    let where: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        document = { branchid: 2, billingid: 1 };
        where = vi.fn().mockReturnThis();
        const db: any = () => ({ join() { return this; }, where, select() { return this; }, first: async () => document });
        vi.mocked(KnexConnection).mockResolvedValue(db);
    });
    async function call(body: any = {}, role = 'cashier', branch: number | null = 2) {
        const req: any = { query: { tenantId: 1 }, params: {}, body: { serviceid: 11, employeeid: 99, ...body },
            authUser: { tenantId: 1, employeeid: 7, role, branch } };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn(); await requireRefundActor(req, res, next); return { req, res, next };
    }
    it('binds body and nested witness identities to the session', async () => {
        const { req, next } = await call({ serviceid: '11', witnesses: [{ employeeid: 99, message: 'reviewed' }] });
        expect(next).toHaveBeenCalledOnce();
        expect(req.body).toMatchObject({ employeeid: 7, serviceid: 11, billingid: 1, witnesses: [{ employeeid: 7 }] });
    });
    it.each(['1e2', '11junk', true, [], {}, 0, -1, 1.1])('rejects ambiguous IDs before document lookup: %j', async serviceid => {
        const { next, res } = await call({ serviceid, billingid: 1 });
        expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(400);
        expect(where).not.toHaveBeenCalled();
    });
    it('binds a supplied bill ID to the selected service', async () => {
        await call({ billingid: 1 }); expect(where).toHaveBeenCalledWith('b.billingid', 1);
    });
    it.each([8, null])('denies other branches and unassigned staff: %j', async branch => {
        const { next, res } = await call({}, 'cashier', branch);
        expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(403);
    });
    it('denies inaccessible documents', async () => {
        document = undefined;
        const { next, res } = await call(); expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(404);
    });
    it.each(['patient', 'clinician', 'marketer', 'pharmacist'])('denies unrelated roles: %s', async role => {
        const { next, res } = await call({}, role); expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(403);
    });
});
