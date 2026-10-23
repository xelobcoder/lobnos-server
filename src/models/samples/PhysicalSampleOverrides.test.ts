import { describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { PhysicalSampleService } from './PhysicalSampleService';

describe('actual specimen overrides', () => {
     it('records the actual EDTA container and preserves the differing original requirements per test', async () => {
          const store = transactionalDatabase({
               'test_ascension as ascension': [
                    { id: 1, ascension_id: 1, billingid: 2, patientid: 4, sample_type_id: 1, container_type_id: 2, unit: 'ml', qty_required: 2 },
                    { id: 2, ascension_id: 2, billingid: 2, patientid: 4, sample_type_id: 1, container_type_id: 3, unit: 'ml', qty_required: 2 },
               ], sampletype: [{ id: 1, name: 'Blood' }], samplecontainer: [{ id: 2, name: 'EDTA' }, { id: 3, name: 'Gel' }],
          });
          vi.mocked(KnexConnection).mockResolvedValue(store.db);
          const service = new PhysicalSampleService(1);
          vi.spyOn(service, 'detail').mockImplementation(async (id, trx: any) => trx('physical_samples').where({ id }).first());
          await expect(service.create({ billingid: 2, ascensionIds: [1, 2], action: 'start' }, 7)).rejects.toThrow('different specimen');
          const sample = await service.create({ billingid: 2, ascensionIds: [1, 2], action: 'start', quantity: 3, unit: 'ml', manualOverride: { sampleTypeId: 1, containerTypeId: 2, reason: 'Corrected configured tube requirement' } }, 7);
          expect(sample).toMatchObject({ container_type_id: 2, container_type_name: 'EDTA', quantity: 3 });
          expect(store.rows('test_ascension_samples')).toMatchObject([{ ascension_id: 1, requirement_key: '1:2:ml' }, { ascension_id: 2, requirement_key: '1:3:ml' }]);
          const audit = store.rows('physical_sample_events')[0];
          expect(audit).toMatchObject({ actor_employeeid: 7, reason: 'Corrected configured tube requirement' });
          expect(JSON.parse(audit.metadata).original_requirements).toMatchObject([{ ascension_id: 1, container_type_id: 2 }, { ascension_id: 2, container_type_id: 3 }]);
     });
});
