import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), preview: vi.fn(), send: vi.fn(), history: vi.fn(), error: vi.fn() }));
vi.mock('../../../middleware/authority', () => ({ getAuthUser: (req: any) => req.authUser }));
vi.mock('../../../hooks/logger', () => ({ default: { error: mocks.error } }));
vi.mock('../../../models/application/sms/events/ResultReadySmsService', () => ({
     ResultReadySmsService: class { workspace = mocks.workspace; preview = mocks.preview; send = mocks.send; history = mocks.history; },
}));
import { getResultReadySmsWorkspace, previewResultReadySms, sendSelectedResultReadySms, getResultReadySmsHistory } from './ResultReadySmsHandlers';
const actor = { tenantId: 1, employeeid: 9, branch: 4, role: 'sonographer' };
async function invoke(handler: any, body: any = {}, query: any = { tenantId: '1', billingid: '2' }, authenticated = true) {
     const res: any = { code: 200, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } };
     await handler({ query, body, authUser: authenticated ? actor : null }, res);
     return res;
}
beforeEach(() => {
     vi.clearAllMocks();
     mocks.workspace.mockResolvedValue({ tests: [] });
     mocks.preview.mockResolvedValue({ fingerprint: 'a'.repeat(64) });
     mocks.send.mockResolvedValue({ jobid: 1, status: 'queued' });
     mocks.history.mockResolvedValue({ items: [], total: 0 });
});
it('uses authenticated identity and validates patient context on workspace reads', async () => {
     const response = await invoke(getResultReadySmsWorkspace, {}, { billingid: '2', patientid: '4' });
     expect(response.body.success).toBe(true);
     expect(mocks.workspace).toHaveBeenCalledWith(actor, 2, 4);
});
it('previews selected tests and ignores caller-provided destination/actor fields', async () => {
     const response = await invoke(previewResultReadySms, { ascensionids: [7, 8], message: 'Come tomorrow', phone: '0999999999', employeeid: 999 });
     expect(response.body.success).toBe(true);
     expect(mocks.preview).toHaveBeenCalledWith(actor, 2, { ascensionids: [7, 8], message: 'Come tomorrow' });
     expect(mocks.send).not.toHaveBeenCalled();
});
it('requires the reviewed fingerprint on explicit POST sends', async () => {
     expect((await invoke(sendSelectedResultReadySms, { ascensionids: [7] })).code).toBe(400);
     expect(mocks.send).not.toHaveBeenCalled();
     const response = await invoke(sendSelectedResultReadySms, { ascensionids: [7], fingerprint: 'a'.repeat(64) });
     expect(response.body.data.status).toBe('queued');
     expect(mocks.send).toHaveBeenCalledWith(actor, 2, { ascensionids: [7], message: undefined, fingerprint: 'a'.repeat(64) });
});
it.each([{}, { ascensionids: [] }, { ascensionids: [7, 7] }, { ascensionids: ['7'] }, { ascensionids: [0] },
     { ascensionids: [7], message: 'a'.repeat(1001) }])('rejects invalid selections before service calls: %j', async body => {
     expect((await invoke(previewResultReadySms, body)).code).toBe(400);
     expect(mocks.preview).not.toHaveBeenCalled();
});
it('bounds history pagination and reports service errors explicitly', async () => {
     expect((await invoke(getResultReadySmsHistory, {}, { billingid: '2', page: '2', count: '10' })).body.success).toBe(true);
     expect(mocks.history).toHaveBeenCalledWith(actor, 2, 2, 10);
     expect((await invoke(getResultReadySmsHistory, {}, { billingid: '2', count: '101' })).code).toBe(400);
     mocks.preview.mockRejectedValue(Object.assign(new Error('Final approval pending'), { statusCode: 409 }));
     const response = await invoke(previewResultReadySms, { ascensionids: [7] });
     expect(response.code).toBe(409);
     expect(response.body).toEqual({ success: false, error: 'Final approval pending' });
     expect(mocks.error).toHaveBeenCalled();
});
it('rejects missing authentication before loading results or history', async () => {
     for (const handler of [getResultReadySmsWorkspace, previewResultReadySms, sendSelectedResultReadySms, getResultReadySmsHistory])
          expect((await invoke(handler, {}, undefined, false)).code).toBe(401);
     expect(mocks.workspace).not.toHaveBeenCalled();
});
it('accepts at most 100 distinct selected test identities', async () => {
     const ascensionids = Array.from({ length: 100 }, (_, index) => index + 1);
     expect((await invoke(previewResultReadySms, { ascensionids })).body.success).toBe(true);
     expect((await invoke(previewResultReadySms, { ascensionids: [...ascensionids, 101] })).code).toBe(400);
     expect(mocks.preview).toHaveBeenCalledTimes(1);
});
