import { describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { collectPharmacyPayment, refundPharmacyPayment } from './PharmacyPayments';
import { assertPharmacyDayOpen, postPharmacyJournal } from './PharmacyLedger';
import { PharmacySaleRepository } from './repositories/PharmacySaleRepository';
const sale:any={id:'sale',receiptNumber:'PHM-sale',accountingVersion:2,paymentAccountId:999,branchid:2,cashierId:3,paymentMethod:'cash',paymentReference:null,totalAmount:85,totalCost:8,amountTendered:100,changeAmount:15,completedAt:new Date()};
function fixture(){const f=transactionalDatabase({
 pharmacy_collection_accounts:[{id:1,account_type:'cash',currency:'GHS',branchid:2,is_active:true}],
 pharmacy_payment_routes:[{id:1,branchid:2,method:'cash',account_id:1}],
 pharmacy_shifts:[{id:'shift3',active_key:'2:3'},{id:'shift4',active_key:'2:4'}],
 pharmacy_sales:[{id:'sale'}],pharmacy_payments:[],pharmacy_financial_days: [{id:1,branchid:2,financial_date:new Date().toISOString().slice(0,10),status:'open',opened_by:3,opened_at:new Date()}],pharmacy_journals:[],pharmacy_journal_lines:[],
 payment_accounts:[{id:999,name:'Lab cash'}],acc_posting_outbox:[],financial_day_closures:[{branchid:2,status:'finalized',financial_date:new Date().toISOString().slice(0,10)}],
 pharmacy_dispenses:[{id:1,sale_id:'sale',prescription_id:'rx',prescription_item_id:'rx-item',quantity:3,is_reversed:false}],
 prescriptions:[{id:'rx',status:'fulfilled'}],prescription_items:[{id:'rx-item',prescription_id:'rx',quantity_ordered:3,quantity_dispensed:3,status:'dispensed'}],
 pharmacy_sale_lines:[{id:'line',sale_id:'sale',inventory_item_id:'drug',item_name_snapshot:'Drug',quantity:3}],
 pharmacy_stock_movements:[{id:'issue',reference_id:'sale',item_id:'drug',branchid:2,transaction_type:'consumption',quantity:3,previous_stock:10,new_stock:7,batch_number:'B',expiry_date:'2099-01-01',unit_cost:2}],
});vi.mocked(KnexConnection).mockResolvedValue(f.db as any);return f;}
describe('independent pharmacy books',()=>{
 it('routes automatically, records net cash and leaves lab accounting untouched',async()=>{
  const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale}));
  expect(f.rows('pharmacy_payments')[0]).toMatchObject({payment_account_id:1,amount:85,status:'collected'});
  expect(f.rows('pharmacy_sales')[0]).toMatchObject({shift_id:'shift3',payment_account_id:1});
  const lines=f.rows('pharmacy_journal_lines');expect(lines.reduce((s,l)=>s+l.debit,0)).toBe(lines.reduce((s,l)=>s+l.credit,0));
  expect(lines.find(l=>l.account_code==='collection:1').debit).toBe(85);
  expect(f.rows('acc_posting_outbox')).toEqual([]);expect(f.rows('payment_accounts')).toEqual([{id:999,name:'Lab cash'}]);
 });
 it('rejects missing shifts and foreign-branch destinations without falling back',async()=>{
  const f=fixture();await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale,cashierId:99}))).rejects.toThrow('shift');
  await f.db.transaction(async(trx:any)=>{await trx('pharmacy_collection_accounts').where({id:1}).forUpdate().first();await trx('pharmacy_collection_accounts').where({id:1}).update({branchid:9});});
  await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale}))).rejects.toThrow('destination');expect(f.rows('pharmacy_payments')).toHaveLength(0);
 });
 it('rolls back payment and journal together',async()=>{
  const f=fixture();await expect(f.db.transaction(async(trx:any)=>{await collectPharmacyPayment(trx,1,{...sale});throw new Error('transaction failure');})).rejects.toThrow('failure');
  expect(f.rows('pharmacy_payments')).toEqual([]);expect(f.rows('pharmacy_journals')).toEqual([]);expect(f.rows('pharmacy_journal_lines')).toEqual([]);
 });
 it('refunds once to the original destination with an optional stock-value reversal',async()=>{
  const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale}));await f.db.transaction((trx:any)=>refundPharmacyPayment(trx,1,sale,4,'Returned goods',true));
  expect(f.rows('pharmacy_payments')[0]).toMatchObject({status:'refunded',refund_shift_id:'shift4'});
  const journal=f.rows('pharmacy_journals').find(j=>j.kind==='refund');expect(f.rows('pharmacy_journal_lines').filter(l=>l.journal_id===journal.id)).toHaveLength(4);
  await expect(f.db.transaction((trx:any)=>refundPharmacyPayment(trx,1,sale,4,'Returned goods',true))).rejects.toThrow('already');
 });
 it('does not post historical sales into the new books',async()=>{
  const f=fixture();await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale,accountingVersion:1}))).rejects.toThrow('Historical');
  await expect(f.db.transaction((trx:any)=>refundPharmacyPayment(trx,1,{...sale,accountingVersion:1},4,'Legacy correction',false))).rejects.toThrow('Legacy');expect(f.rows('pharmacy_journals')).toEqual([]);
 });
 it('enforces balanced journals and pharmacy day closing independently of lab closing',async()=>{
  const f=fixture();await expect(f.db.transaction((trx:any)=>postPharmacyJournal(trx,2,'x','manual','Unbalanced',3,[{account:'sales',credit:20}]))).rejects.toThrow('balance');
  await f.db.transaction(async(trx:any)=>{await assertPharmacyDayOpen(trx,2);await trx('pharmacy_financial_days').where({branchid:2}).update({status:'closed'});});
  await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale}))).rejects.toThrow('closed');
 });
 it('restores prescription quantities for physically returned goods',async()=>{
  const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale}));await f.db.transaction((trx:any)=>new PharmacySaleRepository(1,2).reversePayment(sale,4,'Returned goods','quarantine',trx));
  expect(f.rows('prescription_items')[0]).toMatchObject({quantity_dispensed:0,status:'pending'});expect(f.rows('pharmacy_returns')[0].disposition).toBe('quarantine');
 });
});
