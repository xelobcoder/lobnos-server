import {afterEach, expect, it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {PharmacyCustomerAccounts} from './PharmacySettlement';
let db: any;
afterEach(async () => {if (db) await db.destroy();});
it('finds older unpaid invoices before pagination and keeps every invoice page branch-scoped', async () => {
     const database = accountingSqlDatabase(); db = database.db;
     database.native.exec(`
          CREATE TABLE pharmacy_customer_accounts(id INTEGER,branchid INTEGER);
          CREATE TABLE pharmacy_sales(id TEXT,branchid INTEGER,customer_account_id INTEGER,status TEXT,outstanding_amount NUMERIC,completed_at TEXT);
          INSERT INTO pharmacy_customer_accounts VALUES(1,1),(2,2);
     `);
     await db('pharmacy_sales').insert(Array.from({length:205}, (_, index) => ({id:`paid-${String(index).padStart(3,'0')}`,branchid:1,customer_account_id:1,status:'completed',outstanding_amount:0,completed_at:'2026-11-13'})));
     await db('pharmacy_sales').insert([
          {id:'older-debt',branchid:1,customer_account_id:1,status:'completed',outstanding_amount:100,completed_at:'2020-01-01'},
          {id:'reversed',branchid:1,customer_account_id:1,status:'refunded',outstanding_amount:20,completed_at:'2020-01-02'},
          {id:'foreign',branchid:2,customer_account_id:1,status:'completed',outstanding_amount:999,completed_at:'2026-11-13'},
     ]);
     const service = new PharmacyCustomerAccounts(db,{branch:1,employeeid:1,role:'admin'} as any);
     expect((await service.invoices(1)).length).toBe(200);
     expect(await service.invoices(1,{page:1,status:'outstanding'})).toMatchObject({items:[{id:'older-debt',outstanding_amount:100}],total:1,page:1,totalPages:1});
     const last = await service.invoices(1,{page:999,status:'all'});
     expect(last).toMatchObject({total:207,page:11,totalPages:11});
     expect(last.items).toHaveLength(7);
     expect(last.items.some((row:any) => row.id==='foreign')).toBe(false);
     await expect(service.invoices(2,{page:1})).rejects.toThrow('Account not found');
});
