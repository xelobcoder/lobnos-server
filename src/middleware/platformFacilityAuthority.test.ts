import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../models/Tenancy/MasterOwnerSession', () => ({ getMasterSession: getSession }));
import { requirePlatformFacilityAuthority } from './platformFacilityAuthority';

describe('dedicated master facility authority', () => {
     beforeEach(() => getSession.mockReset());

     async function request(headers: Record<string, string> = {}, tenantId?: string) {
          const req: any = { get: (name: string) => headers[name], query: { tenantId } };
          const res: any = { locals: {}, status: vi.fn().mockReturnThis(), send: vi.fn(), json: vi.fn() };
          const next = vi.fn();
          await requirePlatformFacilityAuthority(req, res, next);
          return { res, next };
     }

     it('accepts the database-backed master session independently of a tenant', async () => {
          getSession.mockResolvedValue({ master: true, sid: 'session', employeeid: 1, tid: 0, exp: 100 });
          const { res, next } = await request({ 'x-pls-master-session': 'opaque' }, '123456');
          expect(getSession).toHaveBeenCalledWith('opaque');
          expect(next).toHaveBeenCalledOnce();
          expect(res.locals.facilityActor).toEqual({ tenantId: 0, employeeId: 1 });
     });

     it('does not accept a staff token in place of a master credential', async () => {
          getSession.mockResolvedValue(null);
          const { res, next } = await request({ 'pls-prime-tenant-session': 'tenant-super-admin-token' });
          expect(getSession).toHaveBeenCalledWith(undefined);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
     });

     it('denies a missing, expired or revoked master session', async () => {
          getSession.mockResolvedValue(null);
          const { res, next } = await request({ 'x-pls-master-session': 'revoked' });
          expect(res.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
     });
});
