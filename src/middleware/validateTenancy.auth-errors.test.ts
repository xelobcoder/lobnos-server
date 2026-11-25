import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
     getRoleByEmail: vi.fn(),
     findSessionById: vi.fn(),
     error: vi.fn(),
}));

vi.mock('../models/settings/users/RolesRepository', () => ({
     default: class { getRoleByEmail = mocks.getRoleByEmail; },
}));
vi.mock('../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class { findSessionById = mocks.findSessionById; },
}));
vi.mock('../hooks/logger', () => ({ default: { error: mocks.error } }));

import { checkTokenExists } from './validateTenancy';

const secret = 'authentication-error-test-secret';
const validToken = () => jwt.sign({ email: 'staff@example.test', employeeid: 7, sid: 'session' }, secret, { expiresIn: '1h' });

async function authenticate(token: string) {
     const request = {
          method: 'GET', path: '/api/v1/foc/accounts', query: { tenantId: '3' },
          headers: { 'pls-prime-tenant-session': token },
     } as unknown as Request;
     const response = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
     const next = vi.fn();
     await checkTokenExists(request, response as unknown as Response, next);
     return { request, response, next };
}

describe('authentication infrastructure failures', () => {
     beforeEach(() => {
          vi.resetAllMocks();
          vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
          mocks.getRoleByEmail.mockResolvedValue({ employeeid: 7, activation: 1, role: 'scientist' });
          mocks.findSessionById.mockResolvedValue({ loggedout: 0, logoutTime: new Date(Date.now() + 60_000) });
     });
     afterEach(() => vi.unstubAllEnvs());

     it('still rejects invalid and expired tokens as authentication errors', async () => {
          const invalid = await authenticate('not-a-token');
          const expired = await authenticate(jwt.sign({ email: 'staff@example.test' }, secret, { expiresIn: -1 }));
          expect(invalid.response.status).toHaveBeenCalledWith(401);
          expect(expired.response.status).toHaveBeenCalledWith(401);
          expect(invalid.next).not.toHaveBeenCalled();
          expect(expired.next).not.toHaveBeenCalled();
          expect(mocks.error).not.toHaveBeenCalled();
     });

     it('continues to authenticate valid sessions', async () => {
          const result = await authenticate(validToken());
          expect(result.next).toHaveBeenCalledOnce();
          expect(result.response.status).not.toHaveBeenCalled();
     });

     it('reports a missing token secret as an operational failure', async () => {
          const token = validToken();
          vi.stubEnv('ACCESS_TOKEN_SECRET', '');
          const result = await authenticate(token);
          expect(result.response.status).toHaveBeenCalledWith(503);
          expect(result.next).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledOnce();
     });

     it.each(['role lookup', 'session lookup'])('reports %s failures as service unavailable without exposing details', async where => {
          const error = Object.assign(new Error('private database details'), { code: 'ECONNREFUSED' });
          if (where === 'role lookup') mocks.getRoleByEmail.mockRejectedValueOnce(error);
          else mocks.findSessionById.mockRejectedValueOnce(error);
          const result = await authenticate(validToken());
          expect(result.response.status).toHaveBeenCalledWith(503);
          expect(result.response.send).toHaveBeenCalledWith({
               status: 'error', statusCode: 503, message: 'Unable to verify your session. Please try again later.',
          });
          expect(result.next).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith('[checkTokenExists] Unable to verify session', { code: 'ECONNREFUSED' });
     });
});
