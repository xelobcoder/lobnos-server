import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../../database/KnexConnections';
import { SalesSessionRepo } from './SalesSessionRepo';

describe('verified sales-session closure', () => {
    const actor = { employeeid: 7, tenantId: 1, branch: 2, role: 'cashier', email: 'cashier@example.test' };
    let session: any;
    let update: ReturnType<typeof vi.fn>;
    let lock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        session = { sessionid: 3, branchid: 2, session_started_by: 7, sessionendedon: null };
        update = vi.fn(async () => 1);
        lock = vi.fn().mockReturnThis();
        const trx: any = () => ({ where() { return this; }, whereNull() { return this; },
            forUpdate: lock, first: async () => session, update });
        trx.fn = { now: () => 'DB_NOW' };
        vi.mocked(KnexConnection).mockResolvedValue({ transaction: async (fn: any) => fn(trx) } as any);
    });
    it('locks and closes the cashier’s own session using the verified identity', async () => {
        await expect(new SalesSessionRepo(1).endSessionAsActor(3, 42.50, actor)).resolves.toBe(1);
        expect(lock).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledWith({ sessionendedon: 'DB_NOW', validatedby: 7, handingoveramount: 42.5 });
    });
    it.each(['scientist', 'customer service representative', 'marketer', 'patient', 'clinician'])(
        'denies closing authority to %s', async role => {
            await expect(new SalesSessionRepo(1).endSessionAsActor(3, 10, { ...actor, role })).rejects.toMatchObject({ statusCode: 403 });
            expect(update).not.toHaveBeenCalled();
        },
    );
    it.each([{ branchid: 8 }, { session_started_by: 9 }, { sessionendedon: '2026-10-28' }])(
        'refuses out-of-scope and already-closed sessions: %j', async change => {
            Object.assign(session, change);
            await expect(new SalesSessionRepo(1).endSessionAsActor(3, 10, actor)).rejects.toThrow();
            expect(update).not.toHaveBeenCalled();
        },
    );
    it.each([-1, NaN, Infinity, 10.001])('rejects invalid handover amount %s', async amount => {
        await expect(new SalesSessionRepo(1).endSessionAsActor(3, amount, actor)).rejects.toThrow();
        expect(update).not.toHaveBeenCalled();
    });
    it('allows a supervisor to close another cashier’s session in their branch', async () => {
        session.session_started_by = 99;
        await expect(new SalesSessionRepo(1).endSessionAsActor(3, 0, { ...actor, role: 'manager' })).resolves.toBe(1);
    });
});
