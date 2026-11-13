import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {ITEM_ANALYTICS_SECTIONS, PharmacyItemAnalytics} from './PharmacyItemAnalytics';

let fixture: ReturnType<typeof accountingSqlDatabase>;
beforeEach(async () => {
  fixture = accountingSqlDatabase();
  fixture.native.exec(`
    CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,sku TEXT,consumption_unit TEXT,current_stock NUMERIC,cost_price NUMERIC,pharmacy_batch_tracking INTEGER);
    CREATE TABLE pharmacy_stock_movements(id TEXT PRIMARY KEY,item_id TEXT,branchid INTEGER,transaction_type TEXT,transaction_date TEXT,previous_stock NUMERIC,new_stock NUMERIC,total_cost NUMERIC,batch_number TEXT,expiry_date TEXT,reason TEXT,reference_id TEXT);
    CREATE TABLE pharmacy_batch_recalls(item_id TEXT,branchid INTEGER,batch_number TEXT,status TEXT);
    CREATE TABLE pharmacy_purchase_orders(id TEXT PRIMARY KEY,branchid INTEGER,supplier_id TEXT,status TEXT,created_at TEXT);
    CREATE TABLE pharmacy_workflows(id TEXT PRIMARY KEY,branchid INTEGER,kind TEXT,details TEXT);
    CREATE TABLE pharmacy_purchase_order_lines(id TEXT PRIMARY KEY,order_id TEXT,item_id TEXT,quantity_ordered NUMERIC,quantity_received NUMERIC,unit_cost NUMERIC);
    CREATE TABLE pharmacy_suppliers(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT);
    CREATE TABLE pharmacy_sales(id TEXT PRIMARY KEY,branchid INTEGER,prescription_id TEXT);
  `);
  const db = fixture.db;
  await db('pharmacy_inventory_items').insert([{id:'medicine',branchid:2,name:'Medicine',sku:'MED',consumption_unit:'tablet',current_stock:83,cost_price:2,pharmacy_batch_tracking:1},{id:'foreign',branchid:9,name:'Foreign',sku:'FOREIGN',current_stock:200,cost_price:1}]);
  const movement = (id:string,type:string,date:string,previous:number,next:number,ref='') => ({id,item_id:'medicine',branchid:2,transaction_type:type,transaction_date:date,previous_stock:previous,new_stock:next,total_cost:Math.abs(next-previous)*2,batch_number:'B1',expiry_date:'2099-12-31',reason:type,reference_id:ref});
  await db('pharmacy_stock_movements').insert([
    movement('a','addition','2026-11-01',0,100),movement('b','consumption','2026-11-02',100,90,'sale'),
    movement('c','write_off','2026-11-03',90,85),movement('d','addition','2026-11-04',85,87,'sale'),
    movement('e','consumption','2026-11-05',87,83,'rx-sale'),
    {...movement('foreign-movement','addition','2026-11-02',0,1000),branchid:9},
  ]);
  await db('pharmacy_sales').insert([{id:'sale',branchid:2,prescription_id:null},{id:'rx-sale',branchid:2,prescription_id:'prescription'}]);
  await db('pharmacy_suppliers').insert([{id:'s1',branchid:2,name:'Supplier one'},{id:'s9',branchid:9,name:'Foreign supplier'}]);
  for (const [id,branch,supplier,status,ordered,accepted] of [['o1',2,'s1','partially_received',100,50],['o2',2,'s1','received',10,10],['cancel',2,'s1','cancelled',100,0],['foreign-order',9,'s9','received',1000,1000]] as const) {
    await db('pharmacy_purchase_orders').insert({id,branchid:branch,supplier_id:supplier,status,created_at:'2026-11-02'});
    await db('pharmacy_purchase_order_lines').insert({id:'line-'+id,order_id:id,item_id:'medicine',quantity_ordered:ordered,quantity_received:accepted,unit_cost:2});
  }
  await db('pharmacy_workflows').insert({id:'o1',branchid:2,kind:'supplier_purchase_order',details:JSON.stringify({reference:'PO-2026-000001'})});
});
afterEach(async () => fixture.db.destroy());
const dates = {from:'2026-11-01',to:'2026-11-30'};
describe('item analytics with SQL data', () => {
  it.each(ITEM_ANALYTICS_SECTIONS)('serves the %s page from scoped medicine data', async section => {
    const result = await new PharmacyItemAnalytics(fixture.db,2).report('medicine',section,dates);
    expect(result.item.name).toBe('Medicine');
    expect(result.summary).toMatchObject({physical:83,dispensable:83,issued:14,wasted:5,wasteCost:10});
    expect(JSON.stringify(result)).not.toContain('Foreign supplier');
    expect(result.columns.length).toBeGreaterThan(0);
  });
  it('reconciles gross usage, write-offs, prescription issues and current availability independently', async () => {
    const service = new PharmacyItemAnalytics(fixture.db,2);
    const usage = await service.report('medicine','usage',{...dates,period:'monthly'});
    expect(usage.rows).toMatchObject([{period:'2026-11',quantity:14,cost:28}]);
    expect((await service.report('medicine','wastage',dates)).rows).toMatchObject([{quantity:5,cost:10}]);
    expect((await service.report('medicine','dispensing',dates)).rows).toMatchObject([{quantity:4,cost:8}]);
    expect((await service.report('medicine','usage',{from:'2026-11-03',to:'2026-11-03'})).rows).toEqual([]);
  });
  it('weights supplier fulfilment by quantities and excludes cancelled purchases', async () => {
    const result = await new PharmacyItemAnalytics(fixture.db,2).report('medicine','supplier-performance',dates);
    expect(result.rows).toMatchObject([{supplier:'Supplier one',orders:2,ordered:110,accepted:60}]);
    expect(Number(result.rows[0].fillRate)).toBeCloseTo(60/110*100);
  });
  it('paginates after exact item, date and text filters and clamps an out-of-range page', async () => {
    const service = new PharmacyItemAnalytics(fixture.db,2);
    const result = await service.report('medicine','movements',{...dates,count:1,page:999});
    expect(result).toMatchObject({page:5,totalPages:5,total:5});
    expect(result.rows).toHaveLength(1);
    expect((await service.report('medicine','movements',{...dates,search:'write_off'})).rows).toMatchObject([{id:'c',quantity:-5}]);
    expect((await service.report('medicine','orders',{...dates,supplierId:'s9'})).rows).toEqual([]);
    expect((await service.report('medicine','orders',{...dates,search:'PO-2026-000001'})).rows).toMatchObject([{orderId:'o1',reference:'PO-2026-000001'}]);
    await expect(service.report('foreign','summary',dates)).rejects.toThrow('this branch');
    await expect(service.report('medicine','summary',{...dates,period:'invented'})).rejects.toThrow('period');
  });
});
