import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
const mocks = vi.hoisted(() => ({ update: vi.fn().mockResolvedValue(1) }));
vi.mock('../../LobnosAuth/createAccount', () => ({ updateUserBasicInfo: mocks.update, deleteAccount: vi.fn() }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
import { updateBasicInfo } from './authHandlers';

function fixture(role = 'scientist') {
    const req = {
        authUser: { employeeid: 7, role, branch: 1, tenantId: 2 },
        query: { tenantId: '2', isUser: 'false' },
        body: { employeeid: '7', name: 'Fixture', role, branch: '1', cpassword: 'fixture-current-password' },
    };
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    return { req, res, run: () => updateBasicInfo(req as unknown as Request, res as unknown as Response) };
}
describe('legacy staff profile edit authority', () => {
    beforeEach(() => vi.clearAllMocks());
    it('forces self-service password validation and authenticated identity', async () => {
        const f = fixture();
        await f.run();
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ employeeid: 7, role: 'scientist', branch: 1 }), 2, true);
    });
    it('denies self-escalation, changing another user, foreign locations and tenants', async () => {
        for (const changes of [{ role: 'admin' }, { employeeid: '8' }, { branch: '9' }]) {
            const f = fixture();
            Object.assign(f.req.body, changes);
            await f.run();
            expect(f.res.status).toHaveBeenCalledWith(403);
        }
        const foreign = fixture();
        foreign.req.query.tenantId = '3';
        await foreign.run();
        expect(foreign.res.status).toHaveBeenCalledWith(403);
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it('preserves owner administration of other staff accounts', async () => {
        const f = fixture('admin');
        Object.assign(f.req.body, { employeeid: '8', role: 'sonographer', branch: '9' });
        await f.run();
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ employeeid: '8', role: 'sonographer', branch: '9' }), 2, false);
    });
    it('requires an authenticated session before editing staff information', async () => {
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
        await updateBasicInfo({ query: {} } as Request, res as unknown as Response);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
