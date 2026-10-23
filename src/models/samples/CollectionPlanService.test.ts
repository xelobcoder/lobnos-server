import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { CollectionPlanService, validateCollectionPlan } from './CollectionPlanService';
import { PhysicalSampleService } from './PhysicalSampleService';
const actor: any = { employeeid: 7, tenantId: 1, branch: 4, role: 'phlebotomist' };
const plan = () => ({ billingid: 2, reason: 'Correct tube requirements for this draw', idempotencyKey: 'draw-1', drawnQuantity: 5, containers: [
     { ascensionIds: [1, 2], sampleTypeId: 1, containerTypeId: 2, quantity: 3, unit: 'ml' },
     { ascensionIds: [3], sampleTypeId: 1, containerTypeId: 3, quantity: 2, unit: 'ml' },
] });
function setup(overrides: any = {}) {
     const store = transactionalDatabase({ billing: [{ billingid: 2, branchid: 4, patientid: 9 }], test_ascension: [1, 2, 3].map(id => ({ id, billingid: 2 })), ...overrides });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     vi.spyOn(PhysicalSampleService.prototype, 'create').mockImplementation(async (input, _actor, trx: any) => {
          const [id] = await trx('physical_samples').insert({ billingid: input.billingid, container_type_id: input.manualOverride!.containerTypeId, quantity: input.quantity });
          await trx('test_ascension_samples').insert(input.ascensionIds.map(ascension_id => ({ ascension_id, sample_id: id })));
          return { id };
     });
     vi.spyOn(PhysicalSampleService.prototype, 'detail').mockImplementation(async (id, trx: any) => trx('physical_samples').where({ id }).first());
     return { store, service: new CollectionPlanService(1) };
}
beforeEach(() => vi.restoreAllMocks());
describe('manual collection planning', () => {
     it('supports merged tests and a 3 ml / 2 ml split while preserving each actual container', async () => {
          const { store, service } = setup();
          await service.create(actor, plan());
          expect(store.rows('physical_samples')).toMatchObject([{ container_type_id: 2, quantity: 3 }, { container_type_id: 3, quantity: 2 }]);
          expect(store.rows('test_ascension_samples')).toHaveLength(3);
          expect(PhysicalSampleService.prototype.create).toHaveBeenCalledWith(expect.objectContaining({ ascensionIds: [1, 2], manualOverride: { sampleTypeId: 1, containerTypeId: 2, reason: plan().reason } }), 7, expect.any(Function));
          expect(store.rows('physical_sample_events')[0]).toMatchObject({ event_type: 'collection_plan_override', actor_employeeid: 7, reason: plan().reason });
     });
     it('serializes concurrent identical retries and rejects a changed retry', async () => {
          const { store, service } = setup();
          await Promise.all([service.create(actor, plan()), service.create(actor, plan())]);
          expect(store.rows('physical_samples')).toHaveLength(2);
          await expect(service.create(actor, { ...plan(), reason: 'Different plan' })).rejects.toThrow('Retry key');
     });
     it('rolls every container back if one container cannot be created', async () => {
          const { store, service } = setup();
          const createFirst = vi.mocked(PhysicalSampleService.prototype.create).getMockImplementation()!;
          vi.mocked(PhysicalSampleService.prototype.create).mockImplementationOnce(createFirst).mockRejectedValueOnce(new Error('Invalid tube'));
          await expect(service.create(actor, plan())).rejects.toThrow('Invalid tube');
          expect(store.rows('physical_samples')).toHaveLength(0);
          expect(store.rows('physical_sample_events')).toHaveLength(0);
     });
     it('blocks another branch, already collected tests and processing already started', async () => {
          await expect(setup().service.create({ ...actor, branch: 5 }, plan())).rejects.toThrow('your branch');
          await expect(setup({ test_ascension_samples: [{ ascension_id: 1, sample_id: 10 }] }).service.create(actor, plan())).rejects.toThrow('already have');
          await expect(setup({ test_ascension: [1, 2, 3].map(id => ({ id, billingid: 2, processingStartDate: '2026-10-23' })) }).service.create(actor, plan())).rejects.toThrow('before laboratory');
     });
     it('requires a reason, valid container assignments and matching split volumes', () => {
          expect(() => validateCollectionPlan({ ...plan(), reason: '' })).toThrow('reason');
          expect(() => validateCollectionPlan({ ...plan(), drawnQuantity: 6 })).toThrow('add up');
          expect(() => validateCollectionPlan({ ...plan(), containers: [{ ...plan().containers[0], ascensionIds: [] }] })).toThrow('Each container');
          const split = plan(); split.containers[1].ascensionIds = [1];
          expect(validateCollectionPlan(split).containers).toHaveLength(2);
     });
});
