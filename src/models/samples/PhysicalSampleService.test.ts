import { describe, expect, it, vi } from 'vitest';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { canTransitionPhysicalSample, groupPhysicalSampleCandidates, PhysicalSampleService } from './PhysicalSampleService';
import KnexConnection from '../../database/KnexConnections';
import { q_get_pending_collected_but_unvalidated_samples } from '../creator/queries';

const row = (overrides: Record<string, unknown> = {}) => ({
     ascension_id: 101,
     testid: 10,
     test_name: 'FBC',
     sample_type_id: 1,
     sample_type_name: 'Blood',
     container_type_id: 2,
     container_type_name: 'EDTA Tube',
     qty_required: '2',
     unit: 'ml',
     collectionStartDate: null,
     collectionEndDate: null,
     ...overrides,
});

describe('groupPhysicalSampleCandidates', () => {
     it('groups compatible tests into one physical specimen/container', () => {
          const groups = groupPhysicalSampleCandidates([
               row(),
               row({ ascension_id: 102, testid: 11, test_name: 'Malaria' }),
               row({ ascension_id: 103, testid: 12, test_name: 'Blood Film' }),
          ]);

          expect(groups).toHaveLength(1);
          expect(groups[0]).toMatchObject({ sampleType: 'Blood', containerType: 'EDTA Tube', suggestedQuantity: 2 });
          expect(groups[0].ascensions.map((test: any) => test.ascensionId)).toEqual([101, 102, 103]);
     });

     it('keeps incompatible specimen or container requirements separate', () => {
          const groups = groupPhysicalSampleCandidates([
               row(),
               row({ ascension_id: 102, test_name: 'Urinalysis', sample_type_id: 3, sample_type_name: 'Urine', container_type_id: 4, container_type_name: 'Sterile Cup' }),
               row({ ascension_id: 103, test_name: 'Serology', container_type_id: 5, container_type_name: 'Plain Tube' }),
          ]);

          expect(groups).toHaveLength(3);
     });

     it('preserves duplicate ordered tests by ascension identity', () => {
          const groups = groupPhysicalSampleCandidates([
               row({ ascension_id: 101, testid: 10 }),
               row({ ascension_id: 202, testid: 10 }),
          ]);

          expect(groups[0].ascensions).toHaveLength(2);
          expect(groups[0].ascensions.map((test: any) => test.ascensionId)).toEqual([101, 202]);
     });

     it('uses the largest configured quantity within a shared group', () => {
          const groups = groupPhysicalSampleCandidates([
               row({ qty_required: '1.5' }),
               row({ ascension_id: 102, qty_required: '3' }),
               row({ ascension_id: 103, qty_required: 'not numeric' }),
          ]);

          expect(groups[0].suggestedQuantity).toBe(3);
     });
});

describe('physical sample transition rules', () => {
     it('allows collection, receipt and acceptance in sequence', () => {
          expect(canTransitionPhysicalSample('collection_started', 'collected')).toBe(true);
          expect(canTransitionPhysicalSample('collected', 'received')).toBe(true);
          expect(canTransitionPhysicalSample('received', 'accepted')).toBe(true);
     });

     it('keeps accepted and rejected samples terminal', () => {
          expect(canTransitionPhysicalSample('accepted', 'rejected')).toBe(false);
          expect(canTransitionPhysicalSample('rejected', 'accepted')).toBe(false);
     });
});

describe('sample validation worklist', () => {
     it('includes linked collected or received physical containers', () => {
          expect(q_get_pending_collected_but_unvalidated_samples).toContain("ps.status IN ('collected', 'received')");
          expect(q_get_pending_collected_but_unvalidated_samples).not.toContain('ta.collectionStartDate IS NOT NULL');
          expect(q_get_pending_collected_but_unvalidated_samples).not.toContain('ta.collectionEndDate IS NOT NULL');
     });

     describe('physical collection after historical workflow bypass', () => {
          it('creates a real container from a real collection action despite synthetic legacy dates, then rejects duplicates', async () => {
               const service = new PhysicalSampleService(9);
               const legacyRow = row({ billingid: 3, patientid: 4, collectionStartDate: '2026-01-01', collectionEndDate: '2026-01-01' });
               const requirements: any = {};
               for (const method of ['whereIn', 'orderBy', 'forUpdate']) requirements[method] = vi.fn(() => requirements);
               requirements.then = (resolve: any) => Promise.resolve([legacyRow]).then(resolve);
               vi.spyOn(service as any, 'ascensionRequirementQuery').mockReturnValue(requirements);
               vi.spyOn(service as any, 'synchronizeCollectedAscensions').mockResolvedValue(undefined);
               vi.spyOn(service, 'detail').mockResolvedValue({ id: 10, barcode: 'sample-barcode' });
               let alreadyLinked = false;
               const inserts: Array<{ table: string; data: any }> = [];
               const trx: any = vi.fn((table: string) => {
                    const query: any = {};
                    for (const method of ['whereIn', 'whereNull', 'where']) query[method] = vi.fn(() => query);
                    query.first = vi.fn(async () => alreadyLinked ? { id: 10 } : undefined);
                    query.update = vi.fn(async () => 1);
                    query.insert = vi.fn(async (data: any) => { inserts.push({ table, data }); return [10]; });
                    return query;
               });
               vi.mocked(KnexConnection).mockResolvedValue({ transaction: async (callback: any) => callback(trx) } as any);
               const result = await service.create({ billingid: 3, ascensionIds: [101], action: 'collect' }, 5);
               expect(result).toEqual({ id: 10, barcode: 'sample-barcode' });
               expect(requirements.forUpdate).toHaveBeenCalledOnce();
               const physical = inserts.find(item => item.table === 'physical_samples')!.data;
               expect(physical).toMatchObject({ patientid: 4, billingid: 3, status: 'collected', collected_by: 5 });
               expect(physical.barcode).toBe(physical.sample_uid);
               expect(physical.collected_at).toBeInstanceOf(Date);
               expect(physical.accepted_at).toBeUndefined();
               expect(inserts.find(item => item.table === 'physical_sample_events')!.data).toMatchObject({ event_type: 'collected', actor_employeeid: 5 });
               expect(inserts.find(item => item.table === 'test_ascension_samples')!.data).toMatchObject([{ sample_id: 10, ascension_id: 101, is_required: true }]);
               alreadyLinked = true;
               const count = inserts.length;
               await expect(service.create({ billingid: 3, ascensionIds: [101], action: 'collect' }, 5)).rejects.toThrow('already linked');
               expect(inserts).toHaveLength(count);
          });
     });
});
