import { describe, it, expect, vi } from 'vitest';
import { packageAuthority } from './packageAuthority';
function run(role: string | null, method = 'GET', path = '/api/v1/packages/8/configuration') {
    const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    packageAuthority({ method, path: '/8/configuration', originalUrl: path, authUser: role === null ? null : { role, tenantId: 1, employeeid: 4 } } as any, res, next);
    return { next, res };
}
describe('Package authorization', () => {
    it.each(['accountant', 'scientist', 'customer service representative', 'pharmacist'])('allows %s to read but not configure', role => {
        expect(run(role).next).toHaveBeenCalledOnce();
        for (const method of ['POST', 'PUT', 'DELETE']) expect(run(role, method).res.status).toHaveBeenCalledWith(403);
    });
    it.each(['admin', 'manager', 'Super Admin', 'super_admin'])('allows %s to configure', role => {
        expect(run(role, 'PUT').next).toHaveBeenCalledOnce();
    });
    it.each(['patient', 'clinician', 'organization', 'outsourced', ''])('denies %s even for read-only configuration', role => {
        expect(run(role).res.status).toHaveBeenCalledWith(403);
    });
    it('requires a session and keeps staff billing lookup available under a mounted router', () => {
        expect(run(null).res.status).toHaveBeenCalledWith(401);
        expect(run('accountant', 'POST', '/api/v1/packages/billing/verify/load?tenantId=1').next).toHaveBeenCalledOnce();
        expect(run('accountant', 'POST', '/api/v1/package-tests').res.status).toHaveBeenCalledWith(403);
        expect(run('accountant', 'POST', '/api/v1/organization-packages').res.status).toHaveBeenCalledWith(403);
    });
});
