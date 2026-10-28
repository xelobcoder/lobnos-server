import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { connectionMock, cashPosting, waiverPosting } = vi.hoisted(() => ({ connectionMock: vi.fn(), cashPosting: vi.fn(), waiverPosting: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));
vi.mock('../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingPayment: cashPosting, enqueueBillingWriteOff: waiverPosting }));
vi.mock('../Expenses/AutomatedExpenseLifecycle', () => ({ default: class { async process() {} } }));
import MultiPayment from './multi-payment';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
let db:any, native:any;
const request=(overrides:any={})=>({ service_payments:[{service_id:10,billing_id:42,amount:25,waive_off:0,discount:0,payment_mode_id:8}],total_amount:25,total_waive_off:0,total_discount:0,employeeid:9,tenantId:3,description:'Synthetic collection',...overrides });
beforeEach(async()=>{
 ({db,native}=accountingSqlDatabase());connectionMock.mockResolvedValue(db);vi.clearAllMocks();
 native.exec(`
 CREATE TABLE billing(billingid INTEGER PRIMARY KEY, patientid INTEGER, writeoff NUMERIC DEFAULT 0, paid NUMERIC DEFAULT 0, outstanding NUMERIC DEFAULT 40, payable NUMERIC DEFAULT 40, status TEXT, clientstatus TEXT, lastupdatedby INTEGER, adjustmentType TEXT, adjustmentamount NUMERIC, adjustmentReason TEXT, adjustedBy INTEGER, adjustmentdate TEXT, isAdjustment INTEGER);
 CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY,billingid INTEGER,branchid INTEGER,paidamount NUMERIC,outstanding NUMERIC,totalpayable NUMERIC,paymentstatus TEXT,status TEXT);
 CREATE TABLE billinghx(KeyID INTEGER PRIMARY KEY,billingid INTEGER,paymentmode INTEGER,amount NUMERIC,employeeid INTEGER,type TEXT);
 CREATE TABLE acc_collection_requests(request_key TEXT PRIMARY KEY,fingerprint TEXT,created_at TEXT);
 CREATE TABLE gateway_payment_applications(reference TEXT PRIMARY KEY,billing_id INTEGER,amount_minor INTEGER);
 CREATE TABLE test_postings(id INTEGER PRIMARY KEY,type TEXT,amount NUMERIC);
 `);
 await db('billing').insert({billingid:42,patientid:21});
 await db('dboservices').insert({serviceid:10,billingid:42,branchid:4,paidamount:0,outstanding:40,totalpayable:40,paymentstatus:'pending',status:'active'});
 cashPosting.mockImplementation(async(_t:any,_h:any,_b:any,amount:any,_e:any,trx:any)=>trx('test_postings').insert({type:'cash',amount}));
 waiverPosting.mockImplementation(async(_t:any,_b:any,amount:any,_e:any,trx:any)=>trx('test_postings').insert({type:'waiver',amount}));
});
afterEach(async()=>{await db.destroy();});
describe('Cash collection SQL transactions',()=>{
 it.each([
  {total_amount:25.01}, {total_waive_off:0.01},
  {service_payments:[{service_id:10,billing_id:42,amount:-1,waive_off:0,discount:0,payment_mode_id:8}],total_amount:-1},
  {service_payments:[{service_id:10,billing_id:42,amount:25.005,waive_off:0,discount:0,payment_mode_id:8}],total_amount:25.005},
  {service_payments:[{service_id:10,billing_id:43,amount:25,waive_off:0,discount:0,payment_mode_id:8}]},
  {total_amount:40.01,service_payments:[{service_id:10,billing_id:42,amount:40.01,waive_off:0,discount:0,payment_mode_id:8}]},
 ])('rejects invalid money or bill association without partial writes %#',async overrides=>{
  const result=await new MultiPayment(3).processPayment(request(overrides));expect(result.success).toBe(false);
  expect((await db('dboservices').first()).outstanding).toBe(40);expect(await db('billinghx')).toHaveLength(0);expect(await db('test_postings')).toHaveLength(0);
 });
 it('rejects duplicate services',async()=>{
  const item=request().service_payments[0];expect((await new MultiPayment(3).processPayment(request({service_payments:[item,item],total_amount:50}))).success).toBe(false);
 });
 it('commits cash, waiver, exact bill balances and postings together',async()=>{
  const item={...request().service_payments[0],amount:25,waive_off:15};
  const result=await new MultiPayment(3).processPayment(request({service_payments:[item],total_waive_off:15,requestKey:'synthetic-request-0001'}));
  expect(result.success).toBe(true);expect((await db('billing').first())).toMatchObject({paid:25,outstanding:0,writeoff:15});
  expect((await db('dboservices').first())).toMatchObject({paidamount:25,outstanding:0,paymentstatus:'paid'});
  expect(await db('test_postings')).toHaveLength(2);
 });
 it('replays a successful request once and rejects changing its payload',async()=>{
  const payload=request({requestKey:'synthetic-request-0002'}),model=new MultiPayment(3);
  expect((await model.processPayment(payload)).success).toBe(true);
  expect((await model.processPayment(payload)).alreadyApplied).toBe(true);
  expect((await model.processPayment({...payload,service_payments:[{...payload.service_payments[0],amount:10}],total_amount:10})).success).toBe(false);
  expect((await db('billing').first()).paid).toBe(25);expect(await db('billinghx')).toHaveLength(1);
 });
 it('rolls everything back when accounting enqueue fails; retries can succeed',async()=>{
  const payload=request({requestKey:'synthetic-request-0003'});
  cashPosting.mockRejectedValueOnce(new Error('Synthetic outbox failure'));
  expect((await new MultiPayment(3).processPayment(payload)).success).toBe(false);
  expect(await db('acc_collection_requests')).toHaveLength(0);expect(await db('billinghx')).toHaveLength(0);
  expect((await db('dboservices').first()).paidamount).toBe(0);
  expect((await new MultiPayment(3).processPayment(payload)).success).toBe(true);
 });
 it('two simultaneous collectors cannot overpay the same service',async()=>{
  const [first,second]=await Promise.all([new MultiPayment(3).processPayment(request({requestKey:'synthetic-request-0004'})),new MultiPayment(3).processPayment(request({requestKey:'synthetic-request-0005'}))]);
  expect([first,second].filter(result=>result.success)).toHaveLength(1);
  expect((await db('billing').first()).paid).toBe(25);expect((await db('dboservices').first()).outstanding).toBe(15);
 });
 it('the supplied three-service example commits exactly 100 paid and 48.50 waived',async()=>{
  await db('dboservices').delete();
  for(const [index,amount] of [38.5,55,55].entries())await db('dboservices').insert({serviceid:10+index,billingid:42,branchid:4,paidamount:0,outstanding:amount,totalpayable:amount,paymentstatus:'pending',status:'active'});
  const payments=[25.92,37.04,37.04].map((amount,index)=>({...request().service_payments[0],service_id:10+index,amount,waive_off:[12.58,17.96,17.96][index]}));
  expect((await new MultiPayment(3).processPayment(request({service_payments:payments,total_amount:100,total_waive_off:48.5,requestKey:'synthetic-request-0006'}))).success).toBe(true);
  expect((await db('billing').first())).toMatchObject({paid:100,outstanding:0,writeoff:48.5,payable:148.5});
 });
});
