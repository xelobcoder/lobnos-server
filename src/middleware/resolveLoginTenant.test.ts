import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     tenants: [] as any[],
     localTenant: null as any,
     config: { isMultiTenant: true, desktopStandalone: false, defaultTenantId: 397773 },
}));

vi.mock('../hooks/configuration', () => ({ configuration: mocks.config }));
vi.mock('../hooks/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../models/Tenancy/TenantRegistry', () => ({
     TenantRegistry: class {
          async getByOrganizationIdentifier(prefix: string) { return mocks.tenants.find((t) => t.platformId === prefix) ?? null; }
          async getLocalTenant() { return mocks.localTenant; }
     },
}));

import { resolveLoginTenant } from './resolveLoginTenant';

const run = async (entityType: 'staff' | 'patient' | 'clinician', username: string, organizationNumber?: string) => {
     const req: any = { body: { username, password: 'secret', ...(organizationNumber ? { organizationNumber } : {}) }, query: {} };
     const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
     const next = vi.fn();
     await resolveLoginTenant(entityType)(req, res, next);
     return { req, res, next, statusCode: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
};

describe('resolveLoginTenant', () => {
     beforeEach(() => {
          mocks.config.isMultiTenant = true;
          mocks.config.desktopStandalone = false;
          mocks.localTenant = null;
          mocks.tenants = [
               { tenantId: 397773, platformId: 'PLS20153', isActive: true },
               { tenantId: 827461, platformId: 'PLS20154', isActive: true },
               { tenantId: 197483, platformId: 'PLS20155', isActive: false },
          ];
     });

     it('extracts the organization from the combined username and scopes the staff lookup', async () => {
          const { req, next } = await run('staff', 'PLS20154S004');
          expect(next).toHaveBeenCalled();
          expect(req.query.tenantId).toBe('827461');
          expect(req.body.username).toBe('S4');
     });

     it('rejects unknown organizations, wrong account types, legacy staff names and emails', async () => {
          expect((await run('staff', 'PLS20156S3')).statusCode).toBe(401);
          expect((await run('staff', 'S3', '4')).statusCode).toBe(401);
          expect((await run('staff', 'PLS20154P3')).statusCode).toBe(401);
          expect((await run('staff', 'employee-name')).statusCode).toBe(401);
          expect((await run('staff', 'a@b.com')).body).toMatchObject({ code: 'EMAIL_LOGIN_NOT_ALLOWED' });
     });

     it('blocks organizations whose subscription is not active', async () => {
          expect((await run('staff', 'PLS20155S1')).body).toMatchObject({ statusCode: 403, code: 'TENANT_INACTIVE' });
     });

     it('serves only its own organization in on-premise mode', async () => {
          mocks.config.isMultiTenant = false;
          expect((await run('staff', 'PLS20154S3')).statusCode).toBe(401);
          expect((await run('staff', 'PLS20153S3')).req.query.tenantId).toBe('397773');
     });

     it('desktop standalone login resolves only the local database identity', async () => {
          mocks.config.desktopStandalone = true;
          mocks.config.isMultiTenant = false;
          mocks.localTenant = { tenantId: 397773, platformId: 'PLS20153', isActive: true };
          const { req, next } = await run('staff', 'PLS20153S4');
          expect(next).toHaveBeenCalled();
          expect(req.query.tenantId).toBe('397773');
          expect((await run('staff', 'PLS20154S4')).statusCode).toBe(401);
          mocks.localTenant = { tenantId: 827461, platformId: 'PLS20154', isActive: true };
          expect((await run('staff', 'PLS20154S4')).statusCode).toBe(401);
     });

     it('accepts patient combined identifiers without a separate organization field', async () => {
          const { req, next } = await run('patient', 'PLS20154P450');
          expect(next).toHaveBeenCalled();
          expect(req.query.tenantId).toBe('827461');
          expect(req.body.username).toBe('P450');
     });

     it('routes clinicians using the same local ID to the tenant encoded in their username', async () => {
          expect((await run('clinician', 'PLS20153C42')).req.query.tenantId).toBe('397773');
          expect((await run('clinician', 'PLS20154C42')).req.query.tenantId).toBe('827461');
     });
});
