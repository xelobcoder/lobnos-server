import {afterEach, describe, expect, it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {PharmacyManagement} from './PharmacyManagement';

let db: any;
afterEach(async () => {if (db) await db.destroy();});
async function fixture() {
     const database = accountingSqlDatabase();
     db = database.db;
     database.native.exec(`
          CREATE TABLE pharmacy_inventory_items(id TEXT, branchid INTEGER, name TEXT, sku TEXT, consumption_unit TEXT, current_stock NUMERIC);
          CREATE TABLE pharmacy_stock_movements(item_id TEXT, branchid INTEGER, batch_number TEXT, expiry_date TEXT, previous_stock NUMERIC, new_stock NUMERIC);
          INSERT INTO pharmacy_inventory_items VALUES('medicine',1,'Medicine','MED','tablets',82),('other',2,'Other branch','OTHER','tablets',10);
     `);
     await db('pharmacy_stock_movements').insert(Array.from({length: 31}, (_, index) => ({item_id: 'medicine', branchid: 1, batch_number: `LOT-${String(index).padStart(2, '0')}`, expiry_date: '2099-01-01', previous_stock: 0, new_stock: 2})));
     await db('pharmacy_stock_movements').insert([
          {item_id:'medicine',branchid:1,batch_number:'EXPIRED',expiry_date:'2000-01-01',previous_stock:0,new_stock:20},
          {item_id:'medicine',branchid:1,batch_number:'EMPTY',expiry_date:'2099-01-01',previous_stock:0,new_stock:3},
          {item_id:'medicine',branchid:1,batch_number:'EMPTY',expiry_date:null,previous_stock:3,new_stock:0},
          {item_id:'medicine',branchid:2,batch_number:'FOREIGN',expiry_date:'2099-01-01',previous_stock:0,new_stock:999},
     ]);
     return new PharmacyManagement(db, 1, 1, 'admin');
}
describe('medicine batch balance pages', () => {
     it('aggregates movements and paginates a long history within the operating branch', async () => {
          const service = await fixture();
          const first = await service.batchBalances('medicine', {status:'all'});
          const second = await service.batchBalances('medicine', {status:'all',page:2});
          expect(first).toMatchObject({total:33,totalPages:2,item:{name:'Medicine',unit:'tablets',currentStock:82}});
          expect(first.items).toHaveLength(25);
          expect(second.items).toHaveLength(8);
          expect(new Set([...first.items,...second.items].map(row => row.batch_number)).size).toBe(33);
          expect([...first.items,...second.items].some(row => row.batch_number === 'FOREIGN')).toBe(false);
          await expect(service.batchBalances('other')).rejects.toThrow('not found in this branch');
     });
     it('filters remaining, expired, depleted and literal batch-number searches', async () => {
          const service = await fixture();
          expect((await service.batchBalances('medicine',{status:'remaining'})).total).toBe(32);
          expect((await service.batchBalances('medicine',{status:'expired'})).items).toMatchObject([{batch_number:'EXPIRED',available:20}]);
          expect((await service.batchBalances('medicine',{status:'depleted'})).items).toMatchObject([{batch_number:'EMPTY',available:0}]);
          expect((await service.batchBalances('medicine',{search:'lot-01'})).total).toBe(1);
          expect((await service.batchBalances('medicine',{search:'%'})).total).toBe(0);
          expect(await service.batchBalances('medicine',{page:999,status:'expired'})).toMatchObject({page:1,totalPages:1,total:1});
     });
});
