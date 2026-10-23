import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
vi.mock('../../accountingModule/services/AccountingOutboxService',()=>({enqueuePosting:vi.fn()}));
import KnexConnection from '../../database/KnexConnections';
import { enqueuePosting } from '../../accountingModule/services/AccountingOutboxService';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { collectPharmacyPayment, refundPharmacyPayment } from './PharmacyPayments';
import { PharmacySaleRepository } from './repositories/PharmacySaleRepository';

const sale:any={id:'sale',receiptNumber:'PHM-sale',paymentAccountId:1,branchid:2,cashierId:3,paymentMethod:'cash',paymentReference:null,totalAmount:20,totalCost:8,completedAt:new Date('2026-10-23T10:00:00Z')};
function fixture(){const store=transactionalDatabase({
     payment_accounts:[{id:1,account_type:'cash',currency:'GHS',branchid:2,is_active:true,gl_account_code:'acc-1000'}],
     payment_account_users:[{id:1,payment_account_id:1,employeeid:3,can_pay:true,is_active:true},{id:2,payment_account_id:1,employeeid:4,can_pay:true,is_active:true}],
     acc_accounts:[{id:1,account_code:'acc-1000',type:'asset',is_active:true}],
     pharmacy_sales:[{id:'sale'}],pharmacy_payments:[],financial_day_closures:[],financial_record_locks:[],
     pharmacy_dispenses:[{id:1,sale_id:'sale',prescription_id:'rx',prescription_item_id:'rx-item',quantity:3,is_reversed:false}],
     prescriptions:[{id:'rx',status:'fulfilled'}],prescription_items:[{id:'rx-item',prescription_id:'rx',quantity_ordered:3,quantity_dispensed:3,status:'dispensed'}],
     pharmacy_sale_lines:[{id:'line',sale_id:'sale',inventory_item_id:'drug',item_name_snapshot:'Drug',quantity:3}],
});vi.mocked(KnexConnection).mockResolvedValue(store.db as any);return store;}
beforeEach(()=>vi.clearAllMocks());
describe('pharmacy collection and refund ledger',()=>{
     it('records collection and a balanced accounting posting in the same transaction',async()=>{
          const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,sale));
          expect(f.rows('pharmacy_payments')[0]).toMatchObject({sale_id:'sale',amount:20,status:'collected',recorded_by:3});
          const posting=vi.mocked(enqueuePosting).mock.calls[0][1];expect(posting.lines.filter(line=>line.direction==='debit').reduce((sum,line)=>sum+line.amount,0)).toBe(posting.lines.filter(line=>line.direction==='credit').reduce((sum,line)=>sum+line.amount,0));
          expect(posting.lines.some(line=>line.accountCode==='acc-1003'&&line.amount===8)).toBe(true);
     });
     it('rejects a collector without account access',async()=>{
          const f=fixture();await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale,cashierId:99}))).rejects.toThrow('authorized');expect(f.rows('pharmacy_payments')).toHaveLength(0);
     });
     it('rejects a different branch or mismatched account type',async()=>{
          const f=fixture();await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale,branchid:9}))).rejects.toThrow('branch');
          await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,{...sale,paymentMethod:'card'}))).rejects.toThrow('payment method');
     });
     it('rolls back the collection if accounting enqueue fails',async()=>{
          const f=fixture();vi.mocked(enqueuePosting).mockRejectedValueOnce(new Error('outbox unavailable'));
          await expect(f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,sale))).rejects.toThrow('outbox');expect(f.rows('pharmacy_payments')).toHaveLength(0);
     });
     it('records the refund and rejects a second refund',async()=>{
          const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,sale));
          await f.db.transaction((trx:any)=>refundPharmacyPayment(trx,1,sale,4,'Returned goods',false));
          expect(f.rows('pharmacy_payments')[0]).toMatchObject({status:'refunded',reversed_by:4});
          const posting=vi.mocked(enqueuePosting).mock.calls.at(-1)![1];expect(posting.lines).toHaveLength(2);
          await expect(f.db.transaction((trx:any)=>refundPharmacyPayment(trx,1,sale,4,'Returned goods',false))).rejects.toThrow('already');
     });
     it('restores prescription quantities for physically returned goods',async()=>{
          const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,sale));
          const repo=new PharmacySaleRepository(1,2);await f.db.transaction((trx:any)=>repo.reversePayment(sale,4,'Returned goods','quarantine',trx));
          expect(f.rows('prescription_items')[0]).toMatchObject({quantity_dispensed:0,status:'pending'});expect(f.rows('prescriptions')[0].status).toBe('pending');
          expect(f.rows('pharmacy_dispenses')[0].is_reversed).toBe(true);expect(f.rows('pharmacy_returns')[0].disposition).toBe('quarantine');
     });
     it('retains dispensing quantities when refunded goods were not returned',async()=>{
          const f=fixture();await f.db.transaction((trx:any)=>collectPharmacyPayment(trx,1,sale));
          const repo=new PharmacySaleRepository(1,2);await f.db.transaction((trx:any)=>repo.reversePayment(sale,4,'Goodwill refund','not_returned',trx));
          expect(f.rows('prescription_items')[0].quantity_dispensed).toBe(3);expect(f.rows('pharmacy_returns')[0].disposition).toBe('not_returned');
     });
});
