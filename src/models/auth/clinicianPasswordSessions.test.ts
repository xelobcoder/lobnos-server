import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ password: 'old-password-hash', clinicianId: 42 }));
vi.mock('../../database/KnexConnections', () => ({ default: async () => () => {
     let id: number;
     return {
          where: (filter: { clinicianid: number }) => {
               id = filter.clinicianid;
               return { first: async () => id === state.clinicianId ? { password: state.password } : undefined };
          },
     };
} }));
vi.mock('../../hooks/helper', () => ({
     customError: (message: string, status: number, res: any) => res.status(status).json({ message }),
}));
vi.mock('../Tenancy/tenancyRepo', () => ({ TenancyRepository: class {} }));
vi.mock('../settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../security/repositories/loginlog.repo', () => ({ ApplicationLoginLog: class {} }));

import { clinicianCredentialMatches, clinicianCredentialVersion } from './passwordSessions';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { configuration } from '../../hooks/configuration';

describe('clinician sessions after password reset', () => {
     let previous: boolean;
     beforeEach(() => {
          previous = configuration.isMultiTenant;
          configuration.isMultiTenant = true;
          vi.stubEnv('ACCESS_TOKEN_SECRET', 'clinician-test-secret');
          state.password = 'old-password-hash';
     });
     afterEach(() => { configuration.isMultiTenant = previous; vi.unstubAllEnvs(); });

     async function authenticate(version?: string) {
          const token = jwt.sign({ role: 'clinician', clinicianid: 42, employeeid: 42, tid: 3, cv: version }, 'clinician-test-secret', { expiresIn: '1h' });
          const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
          const next = vi.fn();
          await checkTokenExists({ method: 'GET', path: '/api/v1/clinician-portal/requests', query: { tenantId: '3' },
               headers: { 'pls-prime-tenant-session': token } } as any, res as any, next);
          return { res, next };
     }

     it('rejects a previously valid token immediately after the stored password changes', async () => {
          const oldVersion = clinicianCredentialVersion(state.password);
          expect((await authenticate(oldVersion)).next).toHaveBeenCalledOnce();
          state.password = 'reset-password-hash';
          const stale = await authenticate(oldVersion);
          expect(stale.next).not.toHaveBeenCalled();
          expect(stale.res.status).toHaveBeenCalledWith(401);
          expect((await authenticate(clinicianCredentialVersion(state.password))).next).toHaveBeenCalledOnce();
     });

     it('rejects legacy or malformed credential versions', async () => {
          for (const version of [undefined, '', 'invalid']) {
               expect((await authenticate(version)).res.status).toHaveBeenCalledWith(401);
          }
          expect(clinicianCredentialMatches('x'.repeat(64), state.password)).toBe(false);
     });
});
