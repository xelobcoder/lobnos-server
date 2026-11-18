import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('./authority', () => ({ getAuthUser: (req: any) => req.authUser }));
vi.mock('../database/KnexConnections', () => ({ default: mocks.connection }));
import { requireLaboratoryWorkflowRole, requireResultDeliveryRole, requireResultEntryRole, requireResultValidationRole } from './laboratoryWorkflowAuthority';

describe('laboratory workflow authorization', () => {
    it.each(['patient', 'clinician', 'organization', 'outsourced', 'phlebotomist', 'sonographer'])('rejects %s from processing/results and complete-flow shortcuts', role => {
        const next = vi.fn();
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        requireLaboratoryWorkflowRole({ query: { tenantId: '9' }, authUser: { tenantId: 9, employeeid: 1, role } } as any, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it.each(['admin', 'manager', 'scientist', 'super_admin'])('uses authenticated %s identity, not the payload actor', role => {
        const req: any = { query: { tenantId: '9' }, body: { employeeid: 999 }, authUser: { tenantId: 9, employeeid: 1, role } };
        const next = vi.fn();
        requireLaboratoryWorkflowRole(req, {} as any, next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.body.employeeid).toBe(1);
    });
    it('rejects missing authentication and cross-tenant calls', () => {
        for (const actor of [undefined, { tenantId: 8, role: 'admin' }]) {
            const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();
            requireLaboratoryWorkflowRole({ query: { tenantId: '9' }, authUser: actor } as any, res, next);
            expect(res.status).toHaveBeenCalledWith(actor ? 403 : 401);
            expect(next).not.toHaveBeenCalled();
        }
    });
});

describe('shared result-entry authorization', () => {
    const request = (role: string, branch = 4) => ({
        query: { tenantId: '9' },
        body: { testid: 20, ascensionid: 30, employeeid: 999 },
        authUser: { tenantId: 9, employeeid: 1, branch, role },
    } as any);

    it('allows a sonographer to edit an ultrasound ordered test in their branch', async () => {
        const first = vi.fn().mockResolvedValue({ branchid: 4 });
        const query: any = {
            join: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            whereRaw: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            first,
        };
        mocks.connection.mockResolvedValue(() => query);
        const req = request('sonographer'), next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await requireResultEntryRole(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.body.employeeid).toBe(1);
        expect(query.whereRaw).toHaveBeenCalledWith("LOWER(TRIM(department.department)) = 'ultrasound'");
    });

    it('denies sonographers lab tests, missing orders, and ultrasound from another branch', async () => {
        for (const order of [undefined, { branchid: 5 }]) {
            const query: any = {
                join: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                whereRaw: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue(order),
            };
            mocks.connection.mockResolvedValue(() => query);
            const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            await requireResultEntryRole(request('sonographer'), res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        }
    });

    it('keeps sonographers out of non-result laboratory workflow routes', () => {
        const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        requireLaboratoryWorkflowRole(request('sonographer'), res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('preserves the general workflow bypass for super administrators', async () => {
        mocks.connection.mockClear();
        const req = request('super_admin'), next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await requireResultEntryRole(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.body.employeeid).toBe(1);
        expect(mocks.connection).not.toHaveBeenCalled();
    });
});

describe('ultrasound result-validation authorization', () => {
    const request = (role: string, branch = 4) => ({
        query: { tenantId: '9', ascensionid: '30' },
        body: { ascensionid: 30, employeeid: 999 },
        authUser: { tenantId: 9, employeeid: 1, branch, role },
    } as any);

    it('allows a sonographer to validate an ultrasound result within their branch', async () => {
        const query: any = {
            join: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            whereRaw: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ branchid: 4 }),
        };
        mocks.connection.mockResolvedValue(() => query);
        const req = request('sonographer'), next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await requireResultValidationRole(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.body.employeeid).toBe(1);
        expect(query.whereRaw).toHaveBeenCalledWith("LOWER(TRIM(department.department)) = 'ultrasound'");
    });

    it('accepts a routed report ID when validating report-history access', async () => {
        const query: any = {
            join: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            whereRaw: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ branchid: 4 }),
        };
        mocks.connection.mockResolvedValue(() => query);
        const req = request('sonographer');
        delete req.query.ascensionid;
        const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await requireResultValidationRole(req, res, next, '30');

        expect(next).toHaveBeenCalledOnce();
        expect(query.where).toHaveBeenCalledWith({ 'ta.id': 30 });
    });

    it('denies sonographers outside their branch and leaves other workflow roles unchanged', async () => {
        for (const order of [undefined, { branchid: 5 }]) {
            const query: any = {
                join: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                whereRaw: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue(order),
            };
            mocks.connection.mockResolvedValue(() => query);
            const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            await requireResultValidationRole(request('sonographer'), res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        }
        const next = vi.fn();
        requireResultValidationRole(request('scientist'), {} as any, next);
        expect(next).toHaveBeenCalledOnce();
    });
});

describe('result delivery authorization', () => {
    it.each(['patient', 'clinician', 'organization', 'outsourced', 'phlebotomist'])('rejects %s from delivery records', role => {
        const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        requireResultDeliveryRole({ authUser: { role, branch: 4 } } as any, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it.each(['admin', 'manager', 'scientist', 'sonographer', 'customer service representative'])('allows %s delivery access', role => {
        const next = vi.fn();
        requireResultDeliveryRole({ authUser: { role, branch: 4 } } as any, {} as any, next);
        expect(next).toHaveBeenCalledOnce();
    });
    it('rejects missing authentication and unassigned delivery staff', () => {
        for (const actor of [undefined, { role: 'scientist' }, { role: 'sonographer' }, { role: 'customer service representative' }]) {
            const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            requireResultDeliveryRole({ authUser: actor } as any, res, next);
            expect(res.status).toHaveBeenCalledWith(actor ? 403 : 401);
            expect(next).not.toHaveBeenCalled();
        }
    });
});
