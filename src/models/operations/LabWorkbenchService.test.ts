import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
const stock = vi.hoisted(() => ({ createBulk: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../inventory/InventoryTransaction', () => ({ InventoryTransactionModel: class { createBulk = stock.createBulk; } }));
import KnexConnection from '../../database/KnexConnections';
import { LabWorkbenchService } from './LabWorkbenchService';

const actor: any = { employeeid: 7, branch: 4, role: 'scientist', tenantId: 1 };
function setup(overrides: any = {}) {
     const store = transactionalDatabase({
          'test_ascension as ta': [{ id: 1, serviceid: 6, testid: 3, billingid: 2, patientid: 4, branchid: 4, processingStartDate: new Date() }],
          dboservices: [{ serviceid: 6, status: 'active', isDeleted: 0 }],
          roles: [{ employeeid: 7, role: 'scientist', branch: 4 }, { employeeid: 8, role: 'scientist', branch: 4 }],
          inv_inventory_templates: [{ id: 2, testId: 3, name: 'Test materials' }],
          'inv_inventory_template_items as template': [{ template_id: 2, item_id: 'material', expected: 2, name: 'Reagent', current_stock: 10, cost_price: 5 }],
          inv_inventory_items: [{ id: 'material' }],
          inv_inventory_transactions: [{ item_id: 'material', transaction_type: 'addition', ascensionid: null, batch_number: 'lot', available: 10, expiry_date: '2099-01-01' }],
          ...overrides,
     });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     return { store, service: new LabWorkbenchService(1) };
}
const usage = () => ({ idempotency_key: 'intent-1', template_id: 2, lines: [{ item_id: 'material', quantity: 2 }] });
beforeEach(() => { vi.clearAllMocks(); stock.createBulk.mockResolvedValue([{ id: 'txn-1', total_cost: 10 }]); });
describe('laboratory work and actual material usage', () => {
     it('deducts a shared syringe once and adds traceability to both containers', async () => {
          const { store, service } = setup({ physical_samples: [10, 11].map(id => ({ id, billingid: 2, patientid: 4, status: 'collected', version: 1 })),
               test_ascension_samples: [{ sample_id: 10, ascension_id: 1 }, { sample_id: 11, ascension_id: 1 }],
               inv_inventory_items: [{ id: 'material', is_active: true, current_stock: 10 }] });
          const input = { idempotency_key: 'shared-draw', reason: 'One syringe for the EDTA and gel tubes', lines: [{ item_id: 'material', quantity: 1, sample_ids: [10, 11] }] };
          await Promise.all([service.consume(actor, 1, input, 10), service.consume(actor, 1, input, 10)]);
          expect(stock.createBulk).toHaveBeenCalledTimes(1);
          expect(stock.createBulk.mock.calls[0][0]).toMatchObject([{ quantity: 1, notes: 'Physical samples 10, 11: One syringe for the EDTA and gel tubes' }]);
          expect(store.rows('physical_sample_events')).toHaveLength(2);
          expect(store.rows('physical_sample_events').map(event => event.sample_id)).toEqual([10, 11]);
          expect(store.rows('lab_consumption_records')).toHaveLength(1);
     });
     it('records collection supplies before laboratory processing, once for a shared physical sample', async () => {
          const { store, service } = setup({
               'test_ascension as ta': [{ id: 1, serviceid: 6, testid: 3, billingid: 2, patientid: 4, branchid: 4 }],
               physical_samples: [{ id: 10, billingid: 2, patientid: 4, status: 'collected' }],
               test_ascension_samples: [{ sample_id: 10, ascension_id: 1 }, { sample_id: 10, ascension_id: 2 }],
               inv_inventory_items: [{ id: 'material', is_active: true, current_stock: 10 }],
          });
          const input = { ...usage(), reason: 'Extra tube during collection' };
          const results = await Promise.all([service.consume(actor, 1, input, 10), service.consume(actor, 1, input, 10)]);
          expect(results.map(result => result.retried)).toEqual([false, true]);
          expect(stock.createBulk).toHaveBeenCalledTimes(1);
          expect(stock.createBulk).toHaveBeenCalledWith([expect.objectContaining({ reference_id: 'PHL-10-intent-1', reason: 'Phlebotomy actual supply usage', performed_by: 7 })], expect.any(Function));
          expect(store.rows('lab_work_actions')[0]).toMatchObject({ action: 'collection_supplies_recorded', reason: input.reason });
     });
     it('rejects collection supplies for another patient, unstarted samples or missing usage notes', async () => {
          const { service } = setup({ physical_samples: [{ id: 10, billingid: 2, patientid: 99, status: 'collected' }], test_ascension_samples: [{ sample_id: 10, ascension_id: 1 }] });
          await expect(service.consume(actor, 1, { ...usage(), reason: 'Collection' }, 10)).rejects.toThrow('does not belong');
          await expect(service.consume(actor, 1, usage(), 10)).rejects.toThrow('usage note');
          const unstarted = setup({ physical_samples: [{ id: 10, billingid: 2, patientid: 4, status: 'planned' }], test_ascension_samples: [{ sample_id: 10, ascension_id: 1 }] });
          await expect(unstarted.service.consume(actor, 1, { ...usage(), reason: 'Collection' }, 10)).rejects.toThrow('Start collection');
          expect(stock.createBulk).not.toHaveBeenCalled();
     });
     it('claims work as the signed-in scientist and records an audit action', async () => {
          const { store, service } = setup({lab_access_settings:[{id:1,allow_claim:true}]});
          await service.update(actor, 1, { version: 0, assigned_employeeid: 7, reason: 'Starting my bench work' });
          expect(store.rows('lab_work_assignments')[0]).toMatchObject({ assigned_employeeid: 7, version: 1 });
          expect(store.rows('lab_work_actions')[0]).toMatchObject({ employeeid: 7, action: 'update' });
     });
     it('rejects a stale reassignment and another branch', async () => {
          const { store, service } = setup({ lab_work_assignments: [{ ascensionid: 1, version: 2, assigned_employeeid: 7 }] });
          await expect(service.update(actor, 1, { version: 1, assigned_employeeid: 7 })).rejects.toThrow('changed');
          await expect(service.update({ ...actor, branch: 9 }, 1, { version: 2 })).rejects.toThrow('your branch');
          expect(store.rows('lab_work_actions')).toHaveLength(0);
     });
     it('requires a supervisor and reason to hand over another staff member work', async () => {
          const { service } = setup({ lab_work_assignments: [{ ascensionid: 1, version: 2, assigned_employeeid: 7 }] });
          await expect(service.update(actor, 1, { version: 2, assigned_employeeid: 8 })).rejects.toThrow('supervisor');
          await expect(service.update({ ...actor, role: 'admin' }, 1, { version: 2, assigned_employeeid: 8 })).rejects.toThrow('handover reason');
     });
     it('records stock and audit once for concurrent retries of the same usage intent', async () => {
          const { store, service } = setup();
          const results = await Promise.all([service.consume(actor, 1, usage()), service.consume(actor, 1, usage())]);
          expect(results.map(row => row.retried)).toEqual([false, true]);
          expect(stock.createBulk).toHaveBeenCalledTimes(1);
          expect(stock.createBulk).toHaveBeenCalledWith([expect.objectContaining({ quantity: 2, performed_by: 7, batch_number: 'lot', ascensionid: 1 })], expect.any(Function));
          expect(store.rows('lab_consumption_records')).toHaveLength(1);
     });
     it('rejects reusing a retry key for different quantities', async () => {
          const { service } = setup(); await service.consume(actor, 1, usage());
          await expect(service.consume(actor, 1, { ...usage(), lines: [{ item_id: 'material', quantity: 3 }] })).rejects.toThrow('different quantities');
          expect(stock.createBulk).toHaveBeenCalledTimes(1);
     });
     it('rejects cancelled services and fractional usage when the inventory stores whole units', async () => {
          const cancelled = setup({ dboservices: [{ serviceid: 6, status: 'cancelled' }] });
          await expect(cancelled.service.consume(actor, 1, usage())).rejects.toThrow('cancelled');
          const { service } = setup();
          await expect(service.consume(actor, 1, { ...usage(), lines: [{ item_id: 'material', quantity: 0.5 }] })).rejects.toThrow('whole quantities');
          expect(stock.createBulk).not.toHaveBeenCalled();
     });
     it('does not use expired batch stock or leave usage recorded after an accounting failure', async () => {
          const expired = setup({ inv_inventory_transactions: [{ item_id: 'material', transaction_type: 'addition', batch_number: 'lot', available: 10, expiry_date: '2000-01-01' }] });
          await expect(expired.service.consume(actor, 1, usage())).rejects.toThrow('unexpired');
          expect(stock.createBulk).not.toHaveBeenCalled();
          const { store, service } = setup(); stock.createBulk.mockRejectedValue(new Error('Accounting outbox unavailable'));
          await expect(service.consume(actor, 1, usage())).rejects.toThrow('outbox');
          expect(store.rows('lab_consumption_records')).toHaveLength(0);
          expect(store.rows('lab_work_actions')).toHaveLength(0);
     });
});

it('routine target changes keep the Test Details analytic TAT in the same transaction',async()=>{
 const {store,service}=setup({test_panels:[{id:3}],testdetails:[{testid:3,tat:1,tatEvaluation:'hour'}]});
 await service.targets({...actor,role:'manager'},3,{routine_minutes:1563,urgent_minutes:null,stat_minutes:30});
 expect(store.rows('testdetails')[0]).toMatchObject({tat:1563,tatEvaluation:'min'});expect(store.rows('test_panels')[0]).toMatchObject({lab_routine_tat_minutes:1563});
});
