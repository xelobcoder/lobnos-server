import { describe, expect, it, vi } from 'vitest';
import { requireOrganizationFinanceRole, requirePayrollCompensationRole, requireQcConfigurationRole } from './businessConfigurationAuthority';

function check(guard: any, role: string | null, tenant = 1) {
    const req: any = { query: { tenantId: tenant }, body: { employeeid: 99, updatedby: 99 },
        authUser: role ? { employeeid: 7, role, tenantId: 1, branch: 1 } : null };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    guard(req, res, next);
    return { req, res, next };
}

describe('legacy business configuration authority', () => {
    const roles = ['admin', 'super_admin', 'manager', 'accountant', 'scientist', 'cashier',
        'customer service representative', 'marketer', 'patient', 'clinician', 'pharmacist'];
    it.each(roles)('enforces organization financial configuration for %s', role => {
        const result = check(requireOrganizationFinanceRole, role);
        expect(result.next).toHaveBeenCalledTimes(['admin', 'super_admin', 'manager', 'accountant'].includes(role) ? 1 : 0);
    });
    it.each(roles)('protects compensation from non-payroll roles: %s', role => {
        const result = check(requirePayrollCompensationRole, role);
        expect(result.next).toHaveBeenCalledTimes(['admin', 'super_admin', 'accountant'].includes(role) ? 1 : 0);
    });
    it.each(roles)('protects QC configuration for %s', role => {
        const result = check(requireQcConfigurationRole, role);
        expect(result.next).toHaveBeenCalledTimes(['admin', 'super_admin', 'manager', 'scientist'].includes(role) ? 1 : 0);
    });
    it.each([requireOrganizationFinanceRole, requirePayrollCompensationRole, requireQcConfigurationRole])(
        'rejects absent sessions and tenant mismatches', guard => {
            expect(check(guard, null).res.status).toHaveBeenCalledWith(401);
            expect(check(guard, 'admin', 2).res.status).toHaveBeenCalledWith(403);
        },
    );
    it('binds audit identity without changing the payroll employee being managed', () => {
        const { req, next } = check(requirePayrollCompensationRole, 'accountant');
        expect(next).toHaveBeenCalledOnce();
        expect(req.body).toEqual({ employeeid: 99, updatedby: 7 });
    });
    it('binds snake-case payroll audit fields and does not inject columns into QC records', () => {
        const req: any = { query: { tenantId: 1 }, body: { created_by: 99, updated_by: 99, newCompensation: { employeeid: 88, created_by: 99 } },
            authUser: { employeeid: 7, tenantId: 1, role: 'accountant' } };
        requirePayrollCompensationRole(req, {} as any, () => {});
        expect(req.body).toEqual({ created_by: 7, updated_by: 7, newCompensation: { employeeid: 88, created_by: 7 } });
        const qc = check(requireQcConfigurationRole, 'scientist');
        expect(qc.req.body.employeeid).toBe(99);
        const body = {};
        requireQcConfigurationRole({ ...req, body, authUser: { ...req.authUser, role: 'scientist' } }, {} as any, () => {});
        expect(body).toEqual({});
    });
});
