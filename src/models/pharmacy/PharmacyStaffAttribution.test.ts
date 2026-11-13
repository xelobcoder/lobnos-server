import {afterEach, describe, expect, it, vi} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
const state = vi.hoisted(() => ({db: null as any}));
vi.mock('../../database/KnexConnections', () => ({default: async () => state.db}));
import {PharmacySaleRepository} from './repositories/PharmacySaleRepository';
import {PharmacySaleService} from './services/PharmacySaleService';

afterEach(async () => {if (state.db) await state.db.destroy();state.db = null;});
function fixture() {
    const {db, native} = accountingSqlDatabase();
    state.db = db;
    native.exec(`
        CREATE TABLE pharmacy_sales(id TEXT, branchid INTEGER, cashier_id INTEGER, reversed_by INTEGER,
            receipt_number TEXT, customer_name TEXT, payment_method TEXT, total_amount NUMERIC, status TEXT,
            completed_at TEXT, reversal_type TEXT, reversal_reason TEXT, reversed_at TEXT);
        CREATE TABLE roles(employeeid INTEGER PRIMARY KEY, username TEXT, is_active INTEGER);
        CREATE TABLE pharmacy_sale_lines(id TEXT, sale_id TEXT, item_name_snapshot TEXT);
        INSERT INTO roles VALUES(3,'Original salesperson',1),(4,'Refund manager',0);
        INSERT INTO pharmacy_sales VALUES
            ('sale',1,3,4,'PHM-1','Customer','cash',85,'refunded','2026-11-13 10:00:00','refund','Returned goods','2026-11-13 11:00:00'),
            ('legacy',1,999,77,'PHM-2','Legacy customer','cash',40,'voided','2026-11-12 10:00:00','void','Duplicate','2026-11-13 11:00:00'),
            ('foreign',2,3,4,'PHM-3','Other branch','cash',100,'refunded','2026-11-13 12:00:00','refund','Returned','2026-11-13 13:00:00');
    `);
    return db;
}

describe('pharmacy staff attribution', () => {
    it('returns original salesperson and reversal names in lists and details, including inactive staff', async () => {
        const db = fixture();
        const queries: string[] = [];
        db.on('query', query => queries.push(query.sql));
        const repository = new PharmacySaleRepository(17,1);
        const history = await new PharmacySaleService(repository,1).getSalesHistory({page:1,count:10});
        expect(history.total).toBe(2);
        expect(history.sales.find(sale => sale.id === 'sale')).toMatchObject({cashierId:3,cashierName:'Original salesperson',reversedBy:4,reversedByName:'Refund manager'});
        expect(history.sales.find(sale => sale.id === 'legacy')).toMatchObject({cashierId:999,cashierName:null,reversedBy:77,reversedByName:null});
        expect(queries.filter(sql => sql.includes('from `roles`') || sql.includes('from "roles"'))).toHaveLength(1);
        expect(await new PharmacySaleService(repository,1).getSaleDetail('sale')).toMatchObject({cashierName:'Original salesperson',reversedByName:'Refund manager'});
    });
    it('preserves branch scope, pagination and orphaned legacy sales', async () => {
        fixture();
        const repository = new PharmacySaleRepository(17,1);
        const page = await repository.listSales({page:2,count:1});
        expect(page.total).toBe(2);
        expect(page.sales.map(sale => sale.id)).toEqual(['legacy']);
        expect(await repository.findSaleById('foreign')).toBeNull();
    });
});
