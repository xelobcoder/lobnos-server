import {afterEach, expect, it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {PharmacyStockWorkflows} from './PharmacyStockWorkflows';

let fixture: ReturnType<typeof accountingSqlDatabase>;
afterEach(async () => {
    if (fixture) {
        await fixture.db.destroy();
    }
});

it('finds older purchase requests beyond 200 rows while retaining branch and status scope', async () => {
    fixture = accountingSqlDatabase();
    fixture.native.exec(`CREATE TABLE pharmacy_workflows (
        id TEXT PRIMARY KEY, kind TEXT, branchid INTEGER, target_branchid INTEGER,
        details TEXT, status TEXT, created_at TEXT
    )`);
    for (let index = 0; index < 205; index++) {
        await fixture.db('pharmacy_workflows').insert({
            id: 'request-' + index, kind: 'purchase_requisition', branchid: 2,
            details: JSON.stringify({reason: index === 0 ? 'historical aspirin' : 'routine'}),
            status: index === 0 ? 'approved' : 'requested',
            created_at: new Date(2026, 0, 1, 0, index).toISOString(),
        });
    }
    await fixture.db('pharmacy_workflows').insert({
        id: 'other-branch', kind: 'purchase_requisition', branchid: 3,
        details: JSON.stringify({reason: 'historical aspirin'}), status: 'approved',
        created_at: new Date().toISOString(),
    });
    const service = new PharmacyStockWorkflows(fixture.db, {branch: 2, employeeid: 1, role: 'admin'} as any);
    const historical = await service.purchaseRequests({search: 'historical aspirin', status: 'approved'});
    expect(historical.total).toBe(1);
    expect(historical.items[0].id).toBe('request-0');
    const lastPage = await service.purchaseRequests({page: 9, count: 25});
    expect(lastPage.total).toBe(205);
    expect(lastPage.items).toHaveLength(5);
    expect(lastPage.items.some(row => row.id === 'request-0')).toBe(true);
    await expect(service.purchaseRequests({page: 1.5})).rejects.toThrow('valid page');
});
