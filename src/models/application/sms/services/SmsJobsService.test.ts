import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ parser: vi.fn(), batch: vi.fn(), total: vi.fn(), connect: vi.fn(), send: vi.fn() }));
vi.mock('../../../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('../PrimeSms/SmsMessageParser', () => ({ SmsMessageParser: class {
    humanizeTemplate = mocks.parser; getTotalCount = mocks.total; loadBatchData = mocks.batch;
} }));
vi.mock('../../integrations/Arkesel', () => ({ SmsService: class { sendSms = mocks.send; } }));
import { SmsJobsService, mapJobDtoToDb, smsRecipientKey } from './SmsJobsService';
import { CreateSmsJobSchema } from '../dtos/CreateSmsJobDto';

const valid = { category: 'patient' as const, recipientScope: 'single' as const,
    sendType: 'immediate' as const, customBody: 'Your appointment reminder', createdBy: 7,
    targetIds: [{ id: 1, phone: '+233241234567' }] };
function harness() {
    const trx = {};
    const events: string[] = [];
    mocks.connect.mockResolvedValue({ transaction: async (callback: any) => {
        try { const value = await callback(trx); events.push('commit'); return value; }
        catch (error) { events.push('rollback'); throw error; }
    } });
    const jobs: any = { create: vi.fn(async () => 20), findById: vi.fn(), update: vi.fn() };
    const recipients: any = { bulkInsert: vi.fn(), update: vi.fn(), claimFailedRecipient: vi.fn(async () => 1), findAllByJob: vi.fn(async () => []), findByJobAndRefids: vi.fn(async () => []) };
    const service = new SmsJobsService(jobs, recipients, 7);
    return { service, jobs, recipients, events, trx };
}
describe('SMS campaign persistence and processing', () => {
    beforeEach(() => vi.clearAllMocks());
    it('commits before dispatch and prevents a caller-supplied sent status', async () => {
        const h = harness();
        const dispatch = vi.spyOn(h.service as any, 'processJobData').mockImplementation(async () => { h.events.push('dispatch'); });
        expect(await h.service.createJob({ ...valid, status: 'sent' }, 7)).toBe(20);
        expect(h.events).toEqual(['commit', 'dispatch']);
        expect(dispatch).toHaveBeenCalledWith(20);
        expect(h.jobs.create.mock.calls[0][0]).toMatchObject({ status: 'pending', createdby: 7 });
        expect(h.recipients.bulkInsert).toHaveBeenCalledWith(20, [expect.objectContaining({ refid: 1 })], h.trx);
    });
    it('rolls back if recipient personalization fails and never dispatches', async () => {
        const h = harness(); mocks.parser.mockRejectedValueOnce(new Error('template unavailable'));
        const dispatch = vi.spyOn(h.service as any, 'processJobData');
        await expect(h.service.createJob({ ...valid, customBody: undefined, templateId: 3 }, 7)).rejects.toThrow('template unavailable');
        expect(h.events).toEqual(['rollback']); expect(dispatch).not.toHaveBeenCalled();
    });
    it('rejects a tenant mismatch before opening a transaction', async () => {
        const h = harness(); await expect(h.service.createJob(valid, 3)).rejects.toThrow('tenant mismatch');
        expect(h.jobs.create).not.toHaveBeenCalled();
    });
    it('dispatches all-recipient campaigns with the service tenant', async () => {
        const h = harness(); h.jobs.findById.mockResolvedValue({ jobid: 20, recipientscope: 'all' });
        const batch = vi.spyOn(h.service as any, 'processBatchJob').mockResolvedValue(undefined);
        await (h.service as any).processJobData(20);
        expect(batch).toHaveBeenCalledWith(7, expect.objectContaining({ jobid: 20 }));
    });
    it('includes the first and only recipient in all-recipient campaigns', async () => {
        const h = harness(); mocks.total.mockResolvedValue(1); mocks.batch.mockResolvedValue([{ id: 1, phonee164: '+233241234567' }]);
        const send = vi.spyOn(h.service as any, 'processSingleOrMultipleJob').mockResolvedValue(undefined);
        await (h.service as any).processBatchJob(7, { jobid: 20, category: 'patient', custombody: 'Reminder', sendtype: 'immediate' });
        expect(mocks.batch).toHaveBeenCalledWith(0, 50);
        expect(send).toHaveBeenCalledOnce();
    });
    it('partial edits preserve fields omitted by the caller', () => {
        expect(mapJobDtoToDb({ customBody: 'Changed message' })).toEqual({ custombody: 'Changed message' });
    });
    it('matches provider phone formats without losing recipient acknowledgements', () => {
        expect(smsRecipientKey('+233241234567')).toBe(smsRecipientKey('0241234567'));
        expect(smsRecipientKey('00233241234567')).toBe(smsRecipientKey('241234567'));
    });
    it('returns a successful retry result after the provider acknowledgement is recorded', async () => {
        const h = harness(); h.jobs.findById.mockResolvedValue({ jobid: 20 });
        h.recipients.findByJobAndRefids.mockResolvedValue([{ recid: 2, refid: 1, phonee164: '0241234567', personalizedbody: 'Reminder', deliverystatus: 'failed' }]);
        mocks.send.mockResolvedValue({ status: 'success', data: [{ id: 'provider-id' }] });
        await expect(h.service.retryFailedTransaction(7, 20, 1)).resolves.toMatchObject({ status: 'success' });
        expect(h.recipients.claimFailedRecipient).toHaveBeenCalledWith(2);
        expect(h.recipients.update).toHaveBeenCalledWith(2, expect.objectContaining({ deliverystatus: 'sent', messageid: 'provider-id' }));
    });
    it('does not send if another retry already claimed the recipient', async () => {
        const h = harness(); h.jobs.findById.mockResolvedValue({ jobid: 20 });
        h.recipients.findByJobAndRefids.mockResolvedValue([{ recid: 2, personalizedbody: 'Reminder', deliverystatus: 'failed' }]);
        h.recipients.claimFailedRecipient.mockResolvedValue(0);
        await expect(h.service.retryFailedTransaction(7, 20, 1)).resolves.toMatchObject({ status: 'error' });
        expect(mocks.send).not.toHaveBeenCalled();
    });
    it.each([
        [['failed'], 'failed'], [['sent', 'failed'], 'partialfailed'], [['sent', 'sent'], 'sent'], [['queued'], 'pending'],
    ])('campaign state reflects recipient outcomes: %j', async (statuses, expected) => {
        const h = harness();
        h.recipients.findAllByJob.mockResolvedValue((statuses as string[]).map(deliverystatus => ({ deliverystatus })));
        await (h.service as any).refreshJobStatus(20);
        expect(h.jobs.update).toHaveBeenCalledWith(20, { status: expected });
    });
    it.each([
        { customBody: '   ' }, { targetIds: [] }, { targetIds: [{ id: 'not-an-id', phone: '12' }] },
        { sendType: 'scheduled', scheduledAt: undefined }, { sendType: 'scheduled', scheduledAt: '2000-01-01T10:00:00Z' },
    ])('rejects invalid composition before persistence: %j', patch => {
        expect(CreateSmsJobSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    });
});
