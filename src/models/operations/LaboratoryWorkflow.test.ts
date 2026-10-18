import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), settings: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../application/appsettings/appset', () => ({ default: class { getAllAppSettings = mocks.settings; } }));
import { laboratoryWorkflow, LaboratoryWorkflowService } from './LaboratoryWorkflow';

const all = { byPassCollection: 1, byPassSampleValidation: 1, byPassProcessing: 1 };
const sample = (status: string) => ({ status });

describe('independent laboratory workflow bypasses', () => {
    for (let mask = 0; mask < 8; mask++) {
        const settings = { byPassCollection: mask & 1, byPassSampleValidation: (mask >> 1) & 1, byPassProcessing: (mask >> 2) & 1 };
        it(`evaluates all independent settings without a specimen: ${mask}`, () => {
            const result = laboratoryWorkflow(settings, {}, []);
            expect(result.collection).toBe(settings.byPassCollection ? 'bypassed' : 'pending');
            expect(result.sampleValidation).toBe(settings.byPassSampleValidation ? 'bypassed' : 'pending');
            expect(result.processing).toBe(settings.byPassProcessing ? 'bypassed' : 'pending');
            expect(result.canEnterResults).toBe(mask === 7);
            expect(result.canValidateSample).toBe(false);
            expect(result.canProcess).toBe(mask === 3);
        });
    }
    it('all bypasses satisfy workflow without fabricating physical operations or legacy dates', () => {
        const row = {};
        const samples: any[] = [];
        const result = laboratoryWorkflow(all, row, samples);
        expect(result).toMatchObject({ canEnterResults: true, canValidateSample: false, canCollect: false, blockedReason: null });
        expect(row).toEqual({});
        expect(samples).toEqual([]);
        expect(laboratoryWorkflow(all, row, samples)).toEqual(result);
    });
    it('collection bypass does not silently bypass enabled validation', () => {
        const result = laboratoryWorkflow({ byPassCollection: 1, byPassProcessing: 1 }, {}, []);
        expect(result).toMatchObject({ canEnterResults: false, canCollect: true, canValidateSample: false });
        expect(result.blockedReason).toContain('physical sample');
        expect(laboratoryWorkflow({ byPassCollection: 1, byPassProcessing: 1 }, {}, [sample('collected')]))
            .toMatchObject({ canValidateSample: true, canEnterResults: false });
    });
    it('validation bypass still requires actual collection when collection is enabled', () => {
        expect(laboratoryWorkflow({ byPassSampleValidation: 1, byPassProcessing: 1 }, {}, []).canEnterResults).toBe(false);
        expect(laboratoryWorkflow({ byPassSampleValidation: 1, byPassProcessing: 1 }, {}, [sample('received')]).canEnterResults).toBe(true);
    });
    it('processing remains an independent mandatory stage', () => {
        expect(laboratoryWorkflow({}, {}, [sample('accepted')])).toMatchObject({ canProcess: true, canEnterResults: false });
        expect(laboratoryWorkflow({}, { processingEndDate: '2026-01-01' }, [sample('accepted')]).canEnterResults).toBe(true);
        expect(laboratoryWorkflow({ byPassProcessing: 1 }, {}, [sample('collected')]).canEnterResults).toBe(false);
    });
    it.each(['planned', 'collection_started', 'rejected', 'recollection_required'])('does not bypass a real container in %s', status => {
        const legacy = { collectionEndDate: '2026-01-01', samplevalidatedon: '2026-01-01', approvalstatus: 1, processingEndDate: '2026-01-01', resultEntryStart: '2026-01-01' };
        expect(laboratoryWorkflow(all, legacy, [sample('accepted'), sample(status)]).canEnterResults).toBe(false);
    });
    it('checks all containers, not just a validated legacy row or the latest linked test', () => {
        expect(laboratoryWorkflow({ byPassProcessing: 1 }, { approvalstatus: 1, samplevalidatedon: '2026-01-01' }, [sample('accepted'), sample('received')]))
            .toMatchObject({ canEnterResults: false, canValidateSample: true });
    });
    it('preserves historical legacy acceptance but not rejection/redraw', () => {
        const row = { collectionEndDate: '2026-01-01', processingEndDate: '2026-01-01', approvalstatus: 1, samplevalidatedon: '2026-01-01' };
        expect(laboratoryWorkflow({}, row, []).canEnterResults).toBe(true);
        expect(laboratoryWorkflow(all, { rejectionmessage: 'Specimen unsuitable' }, []).canEnterResults).toBe(false);
        expect(laboratoryWorkflow(all, { isRedraw: 1 }, []).canEnterResults).toBe(false);
    });
    it('does not use completeFlow, test validation or results-entry policy as implicit bypasses', () => {
        expect(laboratoryWorkflow({ completeFlow: 0, byPassValidation: 1 }, {}, []).canEnterResults).toBe(false);
        expect(laboratoryWorkflow({ ...all, completeFlow: 1, byPassValidation: 0 }, {}, []).canEnterResults).toBe(true);
    });
});

describe('authoritative workflow loader and result ownership', () => {
    let db: any;
    let links: any[];
    let row: any;
    let patientid: number;
    let department: string;
    beforeEach(() => {
        vi.clearAllMocks();
        links = [];
        row = { id: 1, testid: 2, billingid: 3 };
        patientid = 4;
        department = 'Laboratory';
        mocks.settings.mockResolvedValue(all);
        db = vi.fn((table: string) => {
            const query: any = {};
            for (const method of ['join', 'leftJoin', 'where', 'whereIn', 'whereNotExists', 'select']) {
                query[method] = vi.fn(() => query);
            }
            query.first = vi.fn(async () => table === 'billing' ? { patientid } : table.startsWith('test_panels') ? { department } : row);
            query.then = (resolve: any, reject: any) => Promise.resolve(links).then(resolve, reject);
            return query;
        });
        mocks.connection.mockResolvedValue(db);
    });
    it('loads tenant-scoped required containers without any writes; retries are stable', async () => {
        const service = new LaboratoryWorkflowService(9);
        const first = await service.forAscensions([row]);
        expect(await service.forAscensions([row])).toEqual(first);
        expect(first[0].workflow.canEnterResults).toBe(true);
        expect(mocks.connection).toHaveBeenCalledWith(9);
        expect(mocks.settings).toHaveBeenCalledWith(9);
        const query = db.mock.results[0].value;
        expect(query.whereIn).toHaveBeenCalledWith('link.ascension_id', [1]);
        expect(query.where).toHaveBeenCalledWith('link.is_required', true);
        expect(query.whereNotExists).toHaveBeenCalledOnce();
        // Mock exposes no insert/update: reads cannot manufacture containers/events/acceptance.
        expect(db.mock.calls.every(([table]: any[]) => table === 'test_ascension_samples as link')).toBe(true);
    });
    it('enforces container state on direct result submission even with all bypasses', async () => {
        links = [{ ascension_id: 1, status: 'rejected' }];
        await expect(new LaboratoryWorkflowService(9).requireResultEntry(1, 2, 3, 4)).rejects.toMatchObject({ statusCode: 409 });
    });
    it.each([[8, 3, 4], [2, 8, 4], [2, 3, 8]])('rejects mismatched test/billing/patient ownership', async (testid, billingid, patient) => {
        await expect(new LaboratoryWorkflowService(9).requireResultEntry(1, testid, billingid, patient)).rejects.toMatchObject({ statusCode: 403 });
    });
    it('accepts legitimate bypass and leaves payment/QC/access-window enforcement to existing result writer', async () => {
        await expect(new LaboratoryWorkflowService(9).requireResultEntry(1, 2, 3, 4)).resolves.toBeUndefined();
    });
    it('does not let a client access an absent ordered test', async () => {
        row = undefined;
        await expect(new LaboratoryWorkflowService(9).requireResultEntry(1, 2, 3, 4)).rejects.toMatchObject({ statusCode: 404 });
    });
    it('does not treat a client isScan flag as authoritative imaging classification', async () => {
        mocks.settings.mockResolvedValue({});
        await expect(new LaboratoryWorkflowService(9).requireResultEntry(1, 2, 3, 4)).rejects.toMatchObject({ statusCode: 409 });
        department = 'Ultrasound';
        await expect(new LaboratoryWorkflowService(9).requireResultEntry(1, 2, 3, 4)).resolves.toBeUndefined();
    });
});
