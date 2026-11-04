import { describe, expect, it, vi } from 'vitest';
vi.mock('./authority', () => ({ getAuthUser: (req: any) => req.authUser }));
import { requireLaboratoryWorkflowRole, requireResultDeliveryRole } from './laboratoryWorkflowAuthority';

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
