import KnexConnection from '../../database/KnexConnections';
import { AccountingReportService } from './AccountingReportService';
import { AccountingError } from '../errors/AccountingErrors';
import { minorUnits } from '../utils/money';
import { addDays, dateOnly, occurrences } from '../utils/recurrence';
function cents(a:number,b:number){const total=a+b;if(!Number.isSafeInteger(total))throw new AccountingError('Forecast total exceeds supported monetary precision','INVALID_AMOUNT',400);return total;}
export class CashForecastService {
 constructor(private tenantId:number,private branchId:number){}
 async report(input:any={}){
  const asOf=new Date().toISOString().slice(0,10),days=Number(input.days??90),collectionPercent=Number(input.collectionPercent??0),collectionDelay=Number(input.collectionDelay??30);
  if(input.asOf&&dateOnly(input.asOf)!==asOf)throw new AccountingError('Forecasts start from today’s ledger. Use the cash-flow statement for historical reporting.','INVALID_FORECAST_DATE',400);
  if(!Number.isInteger(days)||days<1||days>366||!Number.isFinite(collectionPercent)||collectionPercent<0||collectionPercent>100||!Number.isInteger(collectionDelay)||collectionDelay<1||collectionDelay>366)throw new AccountingError('Choose a forecast horizon, collection percentage and delay within the displayed limits','INVALID_FORECAST',400);
  const collectionBps=minorUnits(collectionPercent);
  const to=addDays(asOf,days),db=await KnexConnection(this.tenantId);
  return db.transaction(async(trx:any)=>{
   const banks=await trx('acc_bank_accounts').select('gl_account_code'),codes=[...new Set(['acc-1000','acc-1001',...banks.map((bank:any)=>String(bank.gl_account_code))])];
   const openingLines=await trx('acc_journal_lines as l').join('acc_journal_entries as e','e.id','l.journal_entry_id').join('acc_accounts as a','a.id','l.account_id').where('l.branchid',this.branchId).whereIn('a.account_code',codes).whereNot('e.status','voided').whereRaw('DATE(e.occurred_at) <= ?',[asOf]).select('l.amount','l.direction');
   const opening=openingLines.reduce((sum:number,line:any)=>cents(sum,minorUnits(line.amount)*(line.direction==='debit'?1:-1)),0);
   const events:Array<{date:string;source:string;description:string;amount:number;confidence:string}>=[];
   const add=(date:string,source:string,description:string,amount:number,confidence:string)=>{if(!amount)return;const target=date<=asOf?addDays(asOf,1):date;if(target<=to)events.push({date:target,source,description,amount,confidence});};
   const bills=await trx('invoices').where({branch_id:this.branchId}).whereNotIn('status',['Rejected','Cancelled','Void','Voided']).select('id','due_date','total_amount','status');
   const payments=bills.length?await trx('expense_payments').whereIn('invoice_id',bills.map((bill:any)=>bill.id)).where({status:'Paid'}).where((q:any)=>q.where('is_reversed',false).orWhereNull('is_reversed')).whereRaw('DATE(payment_date) <= ?',[asOf]).select('invoice_id','amount'):[];
   const paid=new Map<number,number>();for(const payment of payments)paid.set(Number(payment.invoice_id),cents(paid.get(Number(payment.invoice_id))||0,minorUnits(payment.amount)));
   let missingDueDates=0;
   for(const bill of bills){const outstanding=Math.max(0,minorUnits(bill.total_amount)-(paid.get(Number(bill.id))||0));if(!outstanding)continue;if(!bill.due_date)missingDueDates++;add(bill.due_date?dateOnly(bill.due_date):addDays(asOf,1),'bill','Vendor bills due',-outstanding,bill.status==='Pending'?'awaiting_approval':'committed');}
   const profiles=input.includeRecurring===false?[]:await trx('acc_recurring_expenses').where({branchid:this.branchId,status:'active'}).whereNotNull('next_run_date');
   for(const profile of profiles){for(const date of occurrences(profile,dateOnly(profile.next_run_date),to))add(date,'recurring',profile.name,-minorUnits(profile.amount),'scheduled_estimate');}
   // Generated expenses without a bill still require approval/payment; do not count them again after invoicing.
   const unbilled=input.includeRecurring===false?[]:await trx('acc_recurring_expense_occurrences as o').join('expensesrecord as e','e.id','o.expense_id').leftJoin('invoice_expenses as i','i.expense_id','e.id').where('e.branchid',this.branchId).whereNull('i.invoice_id').whereNotIn('e.workflow_status',['cancelled','rejected','paid','reversed']).select('e.name','e.amount');
   for(const expense of unbilled)add(addDays(asOf,1),'recurring_pending',expense.name,-minorUnits(expense.amount),'awaiting_approval');
   const receivables=await new AccountingReportService(this.tenantId,trx).receivableAging(asOf,this.branchId);
   const collectible=receivables.rows.reduce((sum:number,row:any)=>cents(sum,Math.max(0,minorUnits(row.total))),0);
   add(addDays(asOf,collectionDelay),'receivables','Assumed collection of existing receivables',Number((BigInt(collectible)*BigInt(collectionBps)+BigInt(5000))/BigInt(10000)),'collection_assumption');
   if(input.scenarios!==undefined&&!Array.isArray(input.scenarios))throw new AccountingError('Invalid cash scenarios','INVALID_FORECAST',400);
   if((input.scenarios||[]).length>50)throw new AccountingError('Use at most fifty scenario entries','INVALID_FORECAST',400);
   for(const scenario of input.scenarios||[]){const date=dateOnly(scenario.date),amount=minorUnits(scenario.amount);if(date<=asOf||date>to||amount<=0||!['in','out'].includes(scenario.direction))throw new AccountingError('Scenario dates must be inside the forecast, with positive amounts and a direction','INVALID_FORECAST',400);add(date,'scenario',String(scenario.description||'What-if cash movement').slice(0,120),amount*(scenario.direction==='in'?1:-1),'what_if');}
   const buckets=new Map<string,{incoming:number;outgoing:number}>();for(const event of events){const bucket=buckets.get(event.date)||{incoming:0,outgoing:0};if(event.amount>0)bucket.incoming=cents(bucket.incoming,event.amount);else bucket.outgoing=cents(bucket.outgoing,-event.amount);buckets.set(event.date,bucket);}
   let balance=opening,min=opening,totalIn=0,totalOut=0,firstShortfall:string|null=opening<0?asOf:null;
   const points=Array.from({length:days},(_,index)=>{const date=addDays(asOf,index+1),bucket=buckets.get(date)||{incoming:0,outgoing:0};totalIn=cents(totalIn,bucket.incoming);totalOut=cents(totalOut,bucket.outgoing);balance=cents(balance,bucket.incoming-bucket.outgoing);min=Math.min(min,balance);if(balance<0&&!firstShortfall)firstShortfall=date;return{date,incoming:bucket.incoming/100,outgoing:bucket.outgoing/100,balance:balance/100};});
   const grouped=new Map<string,any>();for(const event of events){const key=`${event.date}:${event.source}:${event.confidence}:${event.amount>=0?'in':'out'}:${event.source==='scenario'?event.description:''}`;const previous=grouped.get(key);grouped.set(key,{...event,amount:cents(previous?.amount||0,event.amount),description:event.source==='recurring'||event.source==='recurring_pending'?'Recurring expenses':event.description});}
   const pending=await trx('acc_posting_outbox').whereNot('status','posted').count('* as total').first();
   return{asOf,to,days,branchId:this.branchId,totals:{opening:opening/100,incoming:totalIn/100,outgoing:totalOut/100,closing:balance/100,minimum:min/100,firstShortfall},points,events:[...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(event=>({...event,amount:event.amount/100})),assumptions:{collectionPercent,collectionDelay,receivables:collectible/100,missingDueDates,unresolvedPostings:Number(pending?.total||0),note:'Forecast only: vendor bills follow due dates; overdue or undated bills are projected tomorrow. Recurring expenses are estimates, subject to existing approval and payment. Budget targets are not treated as cash. No entries are posted by this report.'}};
  },{isolationLevel:'repeatable read'});
 }
}
