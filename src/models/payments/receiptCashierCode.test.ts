import {describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connect}));
vi.mock('../Expenses/AutomatedExpenseLifecycle',()=>({default:class{}}));
vi.mock('../../accountingModule/integrations/BillingAccounting',()=>({enqueueBillingPayment:vi.fn()}));
import MultiPayment from './multi-payment';
describe('optional cashier code on existing receipts',()=>{
 it.each([false,true])('preserves ordinary receipts when code table availability is %s',async exists=>{
  const bill={billingid:321,patientid:101,payable:'40.00',paid:'20.00',outstanding:'20.00'},service={serviceid:9,totalpayable:'40.00',service_name:'Synthetic test'};
  const queries:string[]=[],writes:any[]=[];
  const db:any=(table:string)=>{queries.push(table);const q:any={where:()=>q,innerJoin:()=>q,leftJoin:()=>q,select:()=>q,first:async()=>table==='billing'?bill:table==='new_patients'?{patientid:101,firstname:'Sample'}:table==='companyprofile'?{NAME:'Synthetic Lab'}:table==='lab_cashier_codes'?{code:'DC29'}:null,insert:async data=>{writes.push({table,data});return[77]},then:resolve=>Promise.resolve(table==='billinghx'?[{PaymentMode:'Cash',Amount:'20.00'}]:[service]).then(resolve)};return q};db.raw=()=>({});db.schema={hasTable:async()=>exists};mocks.connect.mockResolvedValue(db);
  const result=await new MultiPayment(1).generateTransactionReceipt(321,7);
  expect(result).toMatchObject({receiptId:77,billing:bill,services:[service],cashierCode:exists?'DC29':null});
  expect(queries.includes('lab_cashier_codes')).toBe(exists);expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({table:'receipts',data:{billingid:321,generated_by:7,printed:false}});
 });
});
