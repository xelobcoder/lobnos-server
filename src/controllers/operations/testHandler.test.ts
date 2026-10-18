import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../../models/creator/creator', () => ({
     default: class { static createUltrasoundTemplate = mocks.create; static updateUltrasoundTemplate = mocks.update; },
}));
vi.mock('../../testpanel/testpanelList', () => ({ testpanel: {} }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: (req: { authUser?: unknown }) => req.authUser || null }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.error, info: mocks.info } }));
vi.mock('../../hooks/helper', () => ({
     customError: (message: string, statusCode: number, res: Response) => res.status(statusCode).send({ message, statusCode, status: 'error' }),
     responseError: (res: Response) => res.status(500).send({ status: 'error' }),
}));
vi.mock('../../models/operations/imaging/UltrasoundTemplateRepository', async original => ({
     ...await original<typeof import('../../models/operations/imaging/UltrasoundTemplateRepository')>(),
     UltrasoundTemplateRepository: class {
          constructor(private tenantId: number) {}
          delete(...args: unknown[]) { return mocks.remove(this.tenantId, ...args); }
     },
}));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { createUltrasoundTemplateHandler, updateUltrasoundTemplateHandler, deleteUltrasoundTemplateHandler } from './testHandler';

const body = {
     name: 'Kidney', testid: 100221, employeeid: 777, visibleToAll: 1, associatedbodypart: 'Kidney',
     fields: [{ name: 'Findings', id: 21, value: 'Normal' }],
};
const actor = { employeeid: 9, tenantId: 811171, role: 'scientist' };
async function invoke(handler: typeof createUltrasoundTemplateHandler, patch: Record<string, unknown> = {}) {
     const req = { query: { tenantId: '811171' }, params: { templateid: '3' }, body, authUser: actor, ...patch };
     const res = { status: vi.fn(), send: vi.fn() };
     res.status.mockReturnValue(res);
     await handler(req as unknown as Request, res as unknown as Response);
     return res;
}

describe('ultrasound template mutation responses', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.create.mockResolvedValue(true);
          mocks.update.mockResolvedValue(true);
          mocks.remove.mockResolvedValue('deleted');
     });

     it('creates with the authenticated employee, not the body employee', async () => {
          const res = await invoke(createUltrasoundTemplateHandler);
          expect(mocks.create).toHaveBeenCalledWith(811171, expect.objectContaining({
               employeeid: 9, fields: [{ field: 'Findings', fieldid: 21, value: 'Normal' }],
          }));
          expect(res.send).toHaveBeenCalledWith({ status: true });
     });

     it('returns a non-200 error when the Linux table query fails', async () => {
          mocks.create.mockRejectedValueOnce(Object.assign(new Error('Sensitive SQL'), { code: 'ER_NO_SUCH_TABLE' }));
          const res = await invoke(createUltrasoundTemplateHandler);
          expect(res.status).toHaveBeenCalledWith(404);
          expect(res.send).not.toHaveBeenCalledWith({ status: false });
          expect(JSON.stringify(mocks.error.mock.calls)).not.toContain('Sensitive SQL');
     });

     it('rejects incomplete fields and missing visibility before writing', async () => {
          for (const invalid of [{ ...body, visibleToAll: undefined }, { ...body, fields: [{ name: 'No field ID', value: '' }] }]) {
               const res = await invoke(createUltrasoundTemplateHandler, { body: invalid });
               expect(res.status).toHaveBeenCalledWith(400);
          }
          expect(mocks.create).not.toHaveBeenCalled();
     });

     it('rejects missing or invalid update IDs and returns 404 for a removed template', async () => {
          expect((await invoke(updateUltrasoundTemplateHandler)).status).toHaveBeenCalledWith(400);
          mocks.update.mockResolvedValueOnce(false);
          const res = await invoke(updateUltrasoundTemplateHandler, { body: { ...body, keyid: 3 } });
          expect(res.status).toHaveBeenCalledWith(404);
     });

     it.each([createUltrasoundTemplateHandler, updateUltrasoundTemplateHandler, deleteUltrasoundTemplateHandler])(
          'rejects unauthenticated, invalid-tenant and cross-tenant mutations', async handler => {
               expect((await invoke(handler, { authUser: null })).status).toHaveBeenCalledWith(401);
               expect((await invoke(handler, { query: { tenantId: 'wrong' } })).status).toHaveBeenCalledWith(400);
               expect((await invoke(handler, { query: { tenantId: '222222' } })).status).toHaveBeenCalledWith(403);
               expect(mocks.create).not.toHaveBeenCalled();
               expect(mocks.update).not.toHaveBeenCalled();
               expect(mocks.remove).not.toHaveBeenCalled();
          },
     );

     it.each(['admin', 'manager', 'Super Admin'])('permits privileged deletion for %s', async role => {
          const res = await invoke(deleteUltrasoundTemplateHandler, { authUser: { ...actor, role } });
          expect(mocks.remove).toHaveBeenCalledWith(811171, 3, 9, true);
          expect(res.send).toHaveBeenCalledWith({ status: 'success', result: { deleted: true, templateId: 3 } });
     });

     it.each([['forbidden', 403], ['not_found', 404]] as const)('surfaces %s instead of confirming deletion', async (result, status) => {
          mocks.remove.mockResolvedValueOnce(result);
          const res = await invoke(deleteUltrasoundTemplateHandler);
          expect(mocks.remove).toHaveBeenCalledWith(811171, 3, 9, false);
          expect(res.status).toHaveBeenCalledWith(status);
          expect(mocks.info).not.toHaveBeenCalled();
     });

     it.each(['0', '-1', '3oops', '9007199254740992'])('rejects invalid deletion ID %s', async templateid => {
          const res = await invoke(deleteUltrasoundTemplateHandler, { params: { templateid } });
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.remove).not.toHaveBeenCalled();
     });

     it('does not confirm deletion when storage fails', async () => {
          mocks.remove.mockRejectedValueOnce(new Error('Storage unavailable'));
          const res = await invoke(deleteUltrasoundTemplateHandler);
          expect(res.status).toHaveBeenCalledWith(500);
          expect(res.send).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
     });
});
