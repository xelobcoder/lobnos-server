import { afterEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { PharmacyManagement } from './PharmacyManagement';
import { assertPharmacyDayOpen } from './PharmacyLedger';
import { pharmacyReceivingUnits } from './PharmacyRules';

const today = () => new Date().toISOString().slice(0,10);
const fixture = (open = false) => {
     const f = transactionalDatabase({ pharmacy_financial_days: open ? [{id:1,branchid:2,financial_date:today(),status:'open',opened_by:3,opened_at:new Date()}] : [], pharmacy_financial_day_events:[], pharmacy_shifts: [], pharmacy_payment_routes:[{branchid:2,method:'mobile_money',account_id:1}], pharmacy_collection_accounts:[{id:1,branchid:2,is_active:true,currency:'GHS',account_type:'mobile_money'}], pharmacy_documents:[],pharmacy_payments:[] });
     return {...f,service:new PharmacyManagement(f.db,2,3)};
};
afterEach(()=>vi.useRealTimers());
describe('explicit pharmacy financial days',()=>{
     it('does not open a day as a side effect of checking it',async()=>{
          const f=fixture(); await expect(f.db.transaction((trx:any)=>assertPharmacyDayOpen(trx,2))).rejects.toThrow('has not been opened');
          expect(f.rows('pharmacy_financial_days')).toEqual([]);
     });
     it('records an explicit opening and does not duplicate it on retry',async()=>{
          const f=fixture(); await f.service.openDay({date:today(),note:'Morning opening'}); await f.service.openDay({date:today(),note:'Retry'});
          expect(f.rows('pharmacy_financial_days')).toHaveLength(1); expect(f.rows('pharmacy_financial_days')[0]).toMatchObject({status:'open',opened_by:3,opening_note:'Morning opening'});
     });
     it('does not manufacture closed days or reopen a closed financial day',async()=>{
          const f=fixture(); await expect(f.service.closeDay({date:today()})).rejects.toThrow('has not been opened');
          await f.service.openDay({date:today()}); await f.service.closeDay({date:today()});
          await expect(f.service.openDay({date:today()})).rejects.toThrow('already closed');
          expect(await f.service.closeDay({date:today()})).toEqual({date:today(),closed:true});
     });
     it('requires the previous explicit day to be closed first',async()=>{
          vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T10:00:00Z')); const f=fixture(); await f.service.openDay({date:today()});
          vi.setSystemTime(new Date('2026-10-25T10:00:00Z')); await expect(f.service.openDay({date:today()})).rejects.toThrow('previous pharmacy financial day');
     });
     it('reopens with an audit reason, preserves closure history and confirms retries',async()=>{
          const f=fixture(true);await f.service.closeDay({date:today()});
          await expect(f.service.reopenDay({date:today(),reason:'mistake'})).rejects.toThrow('at least 10');
          expect(await f.service.reopenDay({date:today(),reason:'Closed before the final sale was entered'})).toEqual({date:today(),reopened:true});
          expect(f.rows('pharmacy_financial_days')[0]).toMatchObject({status:'open',closed_by:null,closed_at:null});
          expect(f.rows('pharmacy_financial_day_events').find(row=>row.event_type==='reopened')).toMatchObject({branchid:2,financial_date:today(),event_type:'reopened',performed_by:3,reason:'Closed before the final sale was entered'});
          expect(await f.service.reopenDay({date:today(),reason:'Trying to reopen the same day again'})).toMatchObject({alreadyOpen:true});
          expect(f.rows('pharmacy_financial_day_events')).toHaveLength(2);
     });
     it('reopens a historical day while preserving later days and their shifts',async()=>{
          vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));const f=fixture(true);await f.service.closeDay({date:'2026-10-24'});
          vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));
          await f.service.openDay({date:today()});const shift=await f.service.openShift({openingFloat:0});
          expect(await f.service.reopenDay({date:'2026-10-24',reason:'Correcting a mistaken historical day close'})).toMatchObject({reopened:true});
          expect(f.rows('pharmacy_financial_days').find(row=>row.financial_date==='2026-10-25').status).toBe('open');
          expect(f.rows('pharmacy_shifts').find(row=>row.id===shift.id).active_key).toBe('2:3');
          await f.db.transaction((trx:any)=>assertPharmacyDayOpen(trx,2,'2026-10-24'));
     });
     it('rejects future reopening and stale closure timestamps',async()=>{
          const f=fixture(true);await f.service.closeDay({date:today()});
          await expect(f.service.reopenDay({date:'2099-12-31',reason:'A clear explanation of the correction'})).rejects.toThrow('future');
          await expect(f.service.reopenDay({date:today(),expectedClosedAt:'2000-01-01T00:00:00Z',reason:'A clear explanation of the correction'})).rejects.toThrow('Reload');
          expect(f.rows('pharmacy_financial_days')[0].status).toBe('closed');
     });
     it('posts an explicit historical correction to the reopened date and recloses it',async()=>{
          vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));const f=fixture(true);await f.service.closeDay({date:today()});
          vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));await f.service.reopenDay({date:'2026-10-24',reason:'Correct an omitted pharmacy opening balance'});
          await f.service.manualJournal({idempotencyKey:'historical-correction-123',financialDate:'2026-10-24',description:'Approved opening balance correction',confirmed:true,lines:[{account:'inventory',debit:10,credit:0},{account:'opening_equity',debit:0,credit:10}]});
          expect(f.rows('pharmacy_journals')[0].financial_date).toBe('2026-10-24');
          await f.service.closeDay({date:'2026-10-24'});
          expect(f.rows('pharmacy_financial_day_events').map(row=>row.event_type)).toEqual(['closed','reopened','closed']);
          await expect(f.service.manualJournal({idempotencyKey:'another-correction-123',financialDate:'2026-10-24',description:'Another correction',confirmed:true,lines:[{account:'inventory',debit:10},{account:'opening_equity',credit:10}]})).rejects.toThrow('closed');
     });
     it('allows a noncash-only cashier to open a zero-float shift',async()=>{
          const f=fixture(true);const shift=await f.service.openShift({openingFloat:0});expect(f.rows('pharmacy_shifts')[0]).toMatchObject({id:shift.id,financial_date:today(),opening_float:0});
          await expect(f.service.openShift({openingFloat:0})).rejects.toThrow('already');
     });
     it('closes yesterday’s shift after midnight against its own open financial day',async()=>{
          vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T23:00:00Z'));const f=fixture(true);const shift=await f.service.openShift({openingFloat:0});
          vi.setSystemTime(new Date('2026-10-25T01:00:00Z'));const closed=await f.service.closeShift({shiftId:shift.id,countedCash:0});expect(closed.variance).toBe(0);
          expect(f.rows('pharmacy_financial_days')).toHaveLength(1);expect(f.rows('pharmacy_shifts')[0].closed_at).toBeTruthy();
          expect((await f.service.closeShift({shiftId:shift.id,countedCash:0})).variance).toBe(0);
     });
});
describe('operational shift safeguards',()=>{
     it('lets another manager close and review yesterday’s shift before closing its day',async()=>{
          vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T23:00:00Z'));const f=fixture(true);const shift=await f.service.openShift({openingFloat:0});
          vi.setSystemTime(new Date('2026-10-25T01:00:00Z'));const manager=new PharmacyManagement(f.db,2,4);
          await expect(manager.closeDay({date:'2026-10-24'})).rejects.toThrow('Close the cashier shifts');
          await manager.closeShift({shiftId:shift.id,countedCash:0},3);
          await expect(manager.closeDay({date:'2026-10-24'})).rejects.toThrow('Review the closed cashier shifts');
          await manager.reviewShift(shift.id,{note:'Count verified'});await manager.closeDay({date:'2026-10-24'});
          expect(f.rows('pharmacy_shifts')[0]).toMatchObject({closed_by:4,reviewed_by:4});
          await manager.openDay({date:today()});expect(f.rows('pharmacy_financial_days')).toHaveLength(2);
     });
     it('rejects cash disbursements attached to a previous-day shift',async()=>{
          const f=fixture(true);
          await f.db.transaction(async(trx:any)=>{
               await trx('pharmacy_collection_accounts').where({id:1}).forUpdate().first();
               await trx('pharmacy_collection_accounts').where({id:1}).update({account_type:'cash'});
               await trx('pharmacy_payment_routes').insert({branchid:2,method:'cash',account_id:1});
               await trx('pharmacy_shifts').insert({id:'old',branchid:2,cashier_id:3,active_key:'2:3',financial_date:'2020-01-01',opened_at:new Date('2020-01-01')});
          });
          await expect(f.service.disburse('expense',{idempotencyKey:'stale-shift-expense',method:'cash',amount:10,description:'Delivery fee'})).rejects.toThrow('previous day');
          expect(f.rows('pharmacy_documents')).toEqual([]);expect(f.rows('pharmacy_journals')).toEqual([]);
     });
});

describe('purchase-pack receiving',()=>{
     const item={consumption_unit:'tablet',purchase_unit:'box',units_per_purchase_unit:20};
     it('converts purchased packs and retains the supplier cost',()=>{
          expect(pharmacyReceivingUnits(item,{quantity:10,unit_price:100,unit_type:'purchase'})).toEqual({baseQuantity:200,baseUnitCost:5,total:1000,factor:20,receivingUnit:'box'});
     });
     it('keeps fractional unit cost precision for indivisible pack prices',()=>{
          const result=pharmacyReceivingUnits({...item,units_per_purchase_unit:3},{quantity:2,unit_price:10,unit_type:'purchase'});
          expect(result).toMatchObject({baseQuantity:6,total:20,baseUnitCost:3.333333});
     });
     it('keeps individual-unit receiving compatible and rejects stale pack sizes',()=>{
          expect(pharmacyReceivingUnits(item,{quantity:4,unit_price:2,unit_type:'consumption'})).toMatchObject({baseQuantity:4,total:8});
          expect(()=>pharmacyReceivingUnits(item,{quantity:2,unit_price:10,unit_type:'purchase',units_per_purchase_unit:10})).toThrow('pack size changed');
          expect(()=>pharmacyReceivingUnits({consumption_unit:'tablet'},{quantity:2,unit_price:10,unit_type:'purchase'})).toThrow('Configure');
     });
});
