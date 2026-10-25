import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { OutsourceRequestService } from './OutsourceRequestService';
const actor: any = { tenantId: 1, employeeid: 7, branch: 4, role: 'scientist' };
const key = '110b637f-5819-44c5-906b-7233ebed0123';
function fixture() {
    const records = [1,2].map(id => ({ id, patientid: 9, outsourceid: 6, test_name: `Test ${id}`, serviceid: id + 100, billingid: 55, workflow_status: 'awaiting_dispatch', workflow_version: 1 }));
    const store = transactionalDatabase({ outsourcedtesttracking: records, new_patients: [{ patientid: 9, firstname: 'Ama', lastname: 'Mensah', fullpatientid: 'P009' }], companyprofile: [{ name: 'Prime Laboratory', phone: '0300000000' }], outsourcingorganization: [{ outsourceid: 6, name: 'Partner Lab', contactNumber: '0240000000' }] });
    const workflow: any = { detail: vi.fn(async (_actor, id) => { const row = records.find(row => row.id === id); if (!row) throw Error('Out of scope'); return row; }), requestCandidates: vi.fn() };
    return { store, records, workflow, service: new OutsourceRequestService(store.db, workflow) };
}
const draft = () => ({ requestKey: key, priority: 'routine', clinicalNotes: 'Relevant clinical details', requestedBy: 'Dr. K', contact: 'Desk extension 2', items: [1,2].map(trackingId => ({ trackingId, sampleType: 'Serum', sampleId: 'S-009', collectedAt: null, handling: 'Container labelled' })) });
describe('External laboratory requests', () => {
    it('saves a canonical patient/test snapshot without changing dispatch status or accepting forged patient data', async () => {
        const { service, store } = fixture(); const saved = await service.create(actor, 1, { ...draft(), patient: { firstname: 'Forged' }, createdBy: 99 });
        expect(saved.patient.firstname).toBe('Ama'); expect(saved.createdBy).toBe(7); expect(saved.items.map(row => row.testName)).toEqual(['Test 1','Test 2']);
        expect(store.rows('outsourcedtesttracking')[0].workflow_status).toBe('awaiting_dispatch'); expect(store.rows('lab_control_audit')).toHaveLength(1);
    });
    it('retries the same request without creating duplicate documents', async () => {
        const { service, store } = fixture(); const a = await service.create(actor, 1, draft()); const b = await service.create(actor, 1, draft()); expect(a.id).toBe(b.id); expect(store.rows('lab_control_audit')).toHaveLength(1);
    });
    it('rejects mixing patients or receiving laboratories', async () => {
        for (const field of ['patientid','outsourceid']) { const { service, records, store } = fixture(); records[1][field] = 999; await expect(service.create(actor, 1, draft())).rejects.toThrow('one patient'); expect(store.rows('lab_control_audit')).toHaveLength(0); }
    });
    it('enforces scope for every selected test and refuses a missing anchor', async () => {
        const { service, workflow, store } = fixture(); workflow.detail.mockRejectedValueOnce(Error('Out of scope')); await expect(service.create(actor, 1, draft())).rejects.toThrow('Out of scope'); expect(store.rows('lab_control_audit')).toHaveLength(0);
        await expect(service.create(actor, 3, draft())).rejects.toThrow('Include the case');
    });
    it('rejects blank identifiers, duplicate tests and completed cases', async () => {
        const { service, records } = fixture(); const invalid = draft(); invalid.items[0].sampleId = ' '; await expect(service.create(actor, 1, invalid)).rejects.toThrow();
        const duplicate = draft(); duplicate.items[1].trackingId = 1; await expect(service.create(actor, 1, duplicate)).rejects.toThrow('Select each test');
        records[1].workflow_status = 'completed'; await expect(service.create(actor, 1, draft())).rejects.toThrow('Completed');
    });
    it('rolls back if a selected case changed after review', async () => {
        const { service, store } = fixture(); await store.db.transaction(async trx => { await trx('outsourcedtesttracking').where({id:2}).forUpdate().first(); await trx('outsourcedtesttracking').where({id:2}).update({workflow_version:2}); });
        await expect(service.create(actor, 1, draft())).rejects.toThrow('case changed'); expect(store.rows('lab_control_audit')).toHaveLength(0);
    });
    it('reprints the original snapshot and checks access again for all tests', async () => {
        const { service, workflow, store } = fixture(); const saved = await service.create(actor, 1, draft());
        await store.db.transaction(async trx => { await trx('new_patients').where({patientid:9}).forUpdate().first(); await trx('new_patients').where({patientid:9}).update({firstname:'Changed'}); });
        const original = await store.db.transaction(trx => new OutsourceRequestService(trx, workflow).get(actor, 1, saved.id)); expect(original.patient.firstname).toBe('Ama');
        workflow.detail.mockImplementation(async (_actor, id) => { if(id===2)throw Error('Out of scope'); return {id:1}; });
        await expect(store.db.transaction(trx => new OutsourceRequestService(trx, workflow).get(actor, 1, saved.id))).rejects.toThrow('Out of scope');
    });
});
