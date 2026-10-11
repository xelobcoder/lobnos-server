import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     claims: { email: 'staff@example.invalid', tid: 9 },
     roleRow: { employeeid: 5, role: 'admin', activation: 1, branch: null },
     liveEmployee: { employeeid: 5, email: 'staff@example.invalid', role: 'admin', activation: 1, branch: null },
     facility: { id: 3, slug: 'sample-lab', name: 'Sample Lab', status: 'approved', integration_state: 'linked', linked_tenant_id: 9 },
}));

vi.mock('../database/connection', () => ({
     systemConfigConnection: () => ({
          where(criteria: Record<string, unknown>) {
               return { first: async () => Object.entries(criteria).every(([key, value]) => (state.facility as any)[key] === value)
                    ? state.facility : undefined };
          },
     }),
}));
vi.mock('../hooks/configuration', () => ({
     configuration: { isMultiTenant: true, defaultTenantId: 1 },
     effectiveTenantId: (tenantId: number) => tenantId,
}));
vi.mock('../database/KnexConnections', () => ({
     default: async () => (table: string) => ({
          where: () => ({ first: async () => table === 'roles' ? state.liveEmployee : undefined }),
     }),
}));
vi.mock('../models/settings/users/RolesRepository', () => ({
     default: class { async getRoleByEmail() { return state.roleRow; } },
}));
vi.mock('../models/settings/users/TokenValidator', () => ({
     default: class {
          async validateAccessToken() { return { expired: false }; }
          async decodeAccessToken() { return state.claims; }
     },
}));
vi.mock('../models/Tenancy/TenantRegistry', () => ({
     TenantRegistry: class { async requireTenant() { return { isActive: true }; } },
}));
vi.mock('../middleware/validateTenancy', () => ({
     parseCookies: () => ({}),
     verifyStaffSession: async () => ({ ok: true }),
}));

import { requireCoreFacilityStaff } from './coreStaffAuth';
import * as licenseEnforcement from '../licensing/enforcement';
import { LicenseError } from '../licensing/certificate';

function request(body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
     return {
          body, query, params: { slug: 'sample-lab' },
          headers: { 'pls-prime-tenant-session': 'valid-session' },
     } as any;
}

function response() {
     const res: any = {
          locals: {},
          headers: {} as Record<string, string>,
          setHeader(name: string, value: string) { this.headers[name] = value; return this; },
          status(code: number) { this.statusCode = code; return this; },
          json(body: unknown) { this.body = body; return this; },
     };
     return res;
}

describe('integrated marketplace staff authorization boundary', () => {
     it('checks licensing for the linked session tenant, not the control tenant, before operations', async () => {
          state.claims = { email: 'staff@example.invalid', tid: 9 } as any;
          state.roleRow = { employeeid: 5, role: 'admin', activation: 1, branch: null };
          state.liveEmployee = { employeeid: 5, email: 'staff@example.invalid', role: 'admin', activation: 1, branch: null };
          state.facility = { ...state.facility, linked_tenant_id: 9 };
          const guard = vi.spyOn(licenseEnforcement, 'requireOperationalLicense')
               .mockRejectedValueOnce(new LicenseError('LICENSE_EXPIRED'));
          try {
               const res = response();
               const next = vi.fn();
               await requireCoreFacilityStaff(request(), res, next);
               expect(guard).toHaveBeenCalledWith(9);
               expect(res.statusCode).toBe(403);
               expect(res.body.message).toBe('LICENSE_EXPIRED');
               expect(next).not.toHaveBeenCalled();
               expect(res.locals.marketplaceCoreStaff).toBeUndefined();
          } finally { guard.mockRestore(); }
     });
     it('binds authorization to the signed tenant and current role, not request tenant input or JWT role', async () => {
          state.claims = { email: 'staff@example.invalid', tid: 9 } as any;
          state.roleRow = { employeeid: 5, role: 'manager', activation: 1, branch: null };
          state.liveEmployee = { employeeid: 5, email: 'staff@example.invalid', role: 'manager', activation: 1, branch: null };
          const req = request();
          const res = response();
          const next = vi.fn();
          await requireCoreFacilityStaff(req, res, next);
          expect(next).toHaveBeenCalledOnce();
          expect(res.locals.marketplaceCoreStaff).toMatchObject({ tenantId: 9, employeeId: 5, role: 'manager', facilityId: 3 });
     });

     it('rejects a client-selected tenant before authenticating or querying facility access', async () => {
          const req = request({ tenantId: 9 });
          const res = response();
          const next = vi.fn();
          await requireCoreFacilityStaff(req, res, next);
          expect(res.statusCode).toBe(400);
          expect(next).not.toHaveBeenCalled();
     });

     it('denies a facility linked to another signed tenant and a changed live role', async () => {
          const next = vi.fn();
          const wrongFacility = response();
          state.facility = { ...state.facility, linked_tenant_id: 10 };
          await requireCoreFacilityStaff(request(), wrongFacility, next);
          expect(wrongFacility.statusCode).toBe(403);
          expect(next).not.toHaveBeenCalled();

          state.facility = { ...state.facility, linked_tenant_id: 9 };
          state.liveEmployee = { employeeid: 5, email: 'staff@example.invalid', role: 'guest', activation: 1, branch: 4 };
          const changedRole = response();
          await requireCoreFacilityStaff(request(), changedRole, next);
          expect(changedRole.statusCode).toBe(403);
          expect(next).not.toHaveBeenCalled();
     });

     it('requires an assigned branch for non-admin PLS staff', async () => {
          state.facility = { ...state.facility, linked_tenant_id: 9 };
          state.roleRow = { employeeid: 5, role: 'scientist', activation: 1, branch: null };
          state.liveEmployee = { employeeid: 5, email: 'staff@example.invalid', role: 'scientist', activation: 1, branch: null };
          const res = response();
          const next = vi.fn();
          await requireCoreFacilityStaff(request(), res, next);
          expect(res.statusCode).toBe(403);
          expect(next).not.toHaveBeenCalled();
     });
});
