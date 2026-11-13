import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../hooks/logger', () => ({default: {error: vi.fn(), info: vi.fn()}}));
vi.mock('../../TestCreation/TestCreationRulesRepository', () => ({default: class {}}));
vi.mock('../repositories/ResultValueAnalyticsRepository', () => ({ResultValueAnalyticsRepository: class {}}));
vi.mock('../../../utils/encryptionModels', () => ({decrypt_value: (value: string) => value}));
import { ResultValueAnalyticsService } from './ResultValueAnalyticsService';

describe('result analytics committed identity', () => {
    it('uses the database result identity for live processing and backfill', async () => {
        const observations = new Map();
        const repo: any = {
            getSourceResultId: vi.fn().mockResolvedValue(700),
            upsertObservation: vi.fn(async (row: any) => observations.set(row.sourceResultId, row)),
            ensureAnalyticsProcessedColumn: vi.fn(),
            getUnprocessedResultsBatch: vi.fn().mockResolvedValueOnce([{id:700, testid:1, ascensionid:2, fieldid:3, originalvalue:'5', value:'5', created_on:'2026-11-12'}]).mockResolvedValue([]),
            upsertObservationsBatch: vi.fn(async (rows: any[]) => rows.forEach(row => observations.set(row.sourceResultId, row))),
            markResultsProcessed: vi.fn(), removeResultObservation: vi.fn()
        };
        const service = new ResultValueAnalyticsService(repo, {} as any);
        await service.processCommittedResultEntry({tenantId:1,testid:1,ascensionid:2,patientid:1,fields:[{fieldid:3,originalvalue:'5',value:'5'}]});
        await service.backfillHistoricalResultValues(1);
        expect([...observations.keys()]).toEqual([700]);
        expect(repo.getSourceResultId).toHaveBeenCalledWith(1,2,3);
    });
    it('removes a previously observed value when a committed result is cleared', async () => {
        const repo: any = {getSourceResultId: vi.fn().mockResolvedValue(700), removeResultObservation: vi.fn(), upsertObservation: vi.fn()};
        const service = new ResultValueAnalyticsService(repo, {} as any);
        await service.processCommittedResultEntry({tenantId:1,testid:1,ascensionid:2,patientid:1,fields:[{fieldid:3,originalvalue:'',value:''}]});
        expect(repo.removeResultObservation).toHaveBeenCalledWith(1,2,3);
        expect(repo.upsertObservation).not.toHaveBeenCalled();
    });
});
