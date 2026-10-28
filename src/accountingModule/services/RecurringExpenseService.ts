import KnexConnection from '../../database/KnexConnections';
import Expenses from '../../models/Expenses/ExpenseService';
import { AuthorityService } from './AuthorityService';
import { AccountingPeriodService } from './AccountingPeriodService';
import { FinancialFinalizationGuard } from './FinancialFinalizationGuard';
import { AccountingError } from '../errors/AccountingErrors';
import { minorUnits } from '../utils/money';
import { addDays, dateOnly, occurrenceDate, occurrences } from '../utils/recurrence';
import { parsePaging } from '../utils/pagination';
const today=()=>new Date().toISOString().slice(0,10);
function nextDate(profile:any,from:string):string|null{for(let index=0;index<=10000;index++){const date=occurrenceDate(profile,index);if(profile.end_date&&date>dateOnly(profile.end_date))return null;if(date>=from)return date;}throw new AccountingError('Review the recurrence start date','RECURRENCE_LIMIT',400);}
export class RecurringExpenseService {
 constructor(private tenantId:number,private branchId:number){}
 async options(merchantSearch=''){const db=await KnexConnection(this.tenantId);return{merchants:await db('expense_merchants').select('id','name').modify((q:any)=>{if(merchantSearch)q.where('name','like',`%${merchantSearch.slice(0,100)}%`);}).orderBy('name').limit(100),categories:await db('dboexpensecategory').select('id','category').orderBy('category')};}
 async list(query:any={}){const db=await KnexConnection(this.tenantId),paging=parsePaging(query);const base=db('acc_recurring_expenses as r').where('r.branchid',this.branchId);const total=await base.clone().count('* as total').first();const data=await base.leftJoin('expense_merchants as m','m.id','r.merchant_id').leftJoin('dboexpensecategory as c','c.id','r.category_id').select('r.*','m.name as merchant_name','c.category as category_name').orderBy('r.id','desc').limit(paging.count).offset(paging.offset);const counts=data.length?await db('acc_recurring_expense_occurrences').whereIn('profile_id',data.map((row:any)=>row.id)).groupBy('profile_id').select('profile_id').count('* as generated_count'):[];const byId=new Map(counts.map((row:any)=>[Number(row.profile_id),Number(row.generated_count)]));return{data:data.map((row:any)=>({...row,generated_count:byId.get(Number(row.id))||0})),total:Number(total?.total||0),page:paging.page,count:paging.count};}
 async history(id:number,query:any={}){const db=await KnexConnection(this.tenantId),profile=await db('acc_recurring_expenses').where({id,branchid:this.branchId}).first();if(!profile)throw new AccountingError('Schedule not found','SCHEDULE_NOT_FOUND',404);const paging=parsePaging(query),base=db('acc_recurring_expense_occurrences as o').where('o.profile_id',id);const total=await base.clone().count('* as total').first();return{profile,data:await base.join('expensesrecord as e','e.id','o.expense_id').select('o.occurrence_date','o.expense_id','e.amount','e.workflow_status','e.name').orderBy('o.occurrence_date','desc').limit(paging.count).offset(paging.offset),total:Number(total?.total||0),page:paging.page,count:paging.count};}
 async save(input:any,employeeId:number,id?:number){const db=await KnexConnection(this.tenantId);return db.transaction(async(trx:any)=>{
  const before=id?await trx('acc_recurring_expenses').where({id,branchid:this.branchId}).forUpdate().first():null;if(id&&!before)throw new AccountingError('Schedule not found','SCHEDULE_NOT_FOUND',404);
  if(before&&Number(before.version)!==Number(input.version))throw new AccountingError('This schedule changed. Reload before saving.','SCHEDULE_CHANGED',409);
  const name=String(input.name||'').trim(),amount=minorUnits(input.amount),start=dateOnly(input.start_date),end=input.end_date?dateOnly(input.end_date):null,frequency=String(input.frequency),interval=Number(input.interval_count??1);
  if(!name||name.length>120||amount<=0||!Number.isInteger(interval)||interval<1||interval>12||!['daily','weekly','monthly','yearly'].includes(frequency)||end&&end<start)throw new AccountingError('Enter a valid name, amount and recurrence range','INVALID_SCHEDULE',400);
  if(!before&&start<today())throw new AccountingError('Start a new recurring profile today or in the future','INVALID_SCHEDULE',400);
  const merchant=await trx('expense_merchants').where({id:Number(input.merchant_id)}).first(),category=await trx('dboexpensecategory').where({id:Number(input.category_id)}).first();
  if(!merchant||!category)throw new AccountingError('Select a valid merchant and expense category','INVALID_SCHEDULE',400);
  if(/supplier[_\s-]?payments?|bad[_\s-]?debt|^salary$|payroll/i.test(category.category))throw new AccountingError('Use the existing payroll, supplier-payment or write-off workflow for this category','MODULE_OWNED_CATEGORY',400);
  const generated=before?await trx('acc_recurring_expense_occurrences').where({profile_id:id}).orderBy('occurrence_date','desc').first():null;
  if(generated&&(start!==dateOnly(before.start_date)||frequency!==before.frequency||interval!==Number(before.interval_count)))throw new AccountingError('Start date and frequency cannot change after expenses have been generated. Pause this profile and create a new one.','SCHEDULE_HAS_HISTORY',409);
  const schedule={name,description:String(input.description||'').slice(0,2000),amount:amount/100,merchant_id:Number(input.merchant_id),category_id:Number(input.category_id),start_date:start,end_date:end,frequency,interval_count:interval,branchid:this.branchId};
  const floor=input.skip_missed?today():before?.next_run_date?dateOnly(before.next_run_date):generated?addDays(dateOnly(generated.occurrence_date),1):start;
  const next=nextDate(schedule,floor),status=!next?'completed':input.status==='paused'?'paused':'active';
  const after={...schedule,status,next_run_date:next,version:Number(before?.version||0)+1,updated_by:employeeId,updated_at:new Date(),last_error:null};let savedId=id;
  if(before)await trx('acc_recurring_expenses').where({id}).update(after);else savedId=Number((await trx('acc_recurring_expenses').insert({...after,created_by:employeeId,created_at:new Date()}))[0]);
  await trx('acc_control_audit').insert({action:'recurring_expense_saved',entity_id:savedId,employee_id:employeeId,before_state:JSON.stringify(before||{}),after_state:JSON.stringify(after),created_at:new Date()});return{...after,id:savedId};
 });}
 async runDue(asOf=today(),onlyProfile?:number){
  dateOnly(asOf);if(asOf>today())throw new AccountingError('Future expenses cannot be generated early','FUTURE_OCCURRENCE',400);
  const db=await KnexConnection(this.tenantId),profiles=await db('acc_recurring_expenses').where({branchid:this.branchId,status:'active'}).where('next_run_date','<=',asOf).modify((q:any)=>{if(onlyProfile)q.where('id',onlyProfile);}).orderBy('id').limit(100);const result={created:0,errors:[] as Array<{profileId:number;message:string}>};
  for(const selected of profiles){try{
   const count=await db.transaction(async(trx:any)=>{
    const profile=await trx('acc_recurring_expenses').where({id:selected.id,branchid:this.branchId}).forUpdate().first();if(profile.status!=='active'||!profile.next_run_date||dateOnly(profile.next_run_date)>asOf)return 0;
   const owner=await trx('roles').where({employeeid:Number(profile.updated_by)}).select('activation').first();if(!owner||Number(owner.activation)===0)throw new AccountingError('The schedule owner account is disabled or unavailable','SCHEDULE_AUTHORITY_REVOKED',403);
   const authority=await new AuthorityService(this.tenantId).can(Number(profile.updated_by),'expense.create',Number(profile.amount),this.branchId);if(!authority.allowed)throw new AccountingError('The schedule owner no longer has expense creation authority','SCHEDULE_AUTHORITY_REVOKED',403);

    const category=await trx('dboexpensecategory').where({id:profile.category_id}).first();
    if(!await trx('expense_merchants').where({id:profile.merchant_id}).first()||!category)throw new AccountingError('The schedule merchant or category is no longer available','INVALID_SCHEDULE',400);
    if(/supplier[_\s-]?payments?|bad[_\s-]?debt|^salary$|payroll/i.test(category.category))throw new AccountingError('Use the module-owned payment or write-off workflow for this category','MODULE_OWNED_CATEGORY',400);
    const due=occurrences(profile,dateOnly(profile.next_run_date),asOf).slice(0,100);let created=0;
    for(const date of due){const existing=await trx('acc_recurring_expense_occurrences').where({profile_id:profile.id,occurrence_date:date}).first();if(existing)continue;
     await new AccountingPeriodService(this.tenantId).assertPostingAllowed(date,trx);await new FinancialFinalizationGuard(this.tenantId,trx).assertDateOpen(this.branchId,date);
     const expenseId=await new Expenses(profile.updated_by,this.branchId,this.tenantId).generateNewExpense({name:profile.name,description:profile.description||'',amount:Number(profile.amount),merchant:profile.merchant_id,category:profile.category_id,date,employeeid:profile.updated_by,branchid:this.branchId,isassociatedservice:0} as any,`RECURRING-${profile.id}-${date}`,trx);
     if(!expenseId)throw new Error('The expense could not be created');
     await trx('acc_recurring_expense_occurrences').insert({profile_id:profile.id,occurrence_date:date,expense_id:expenseId,created_at:new Date()});created++;
     await trx('acc_control_audit').insert({action:'recurring_expense_generated',entity_id:profile.id,employee_id:profile.updated_by,before_state:JSON.stringify({occurrence:date}),after_state:JSON.stringify({expenseId,workflow_status:'pending_approval'}),created_at:new Date()});
    }
    const after=due.length?new Date(due[due.length-1]+'T00:00:00Z'):null;if(after)after.setUTCDate(after.getUTCDate()+1);
    const next=after?nextDate(profile,after.toISOString().slice(0,10)):null;
    await trx('acc_recurring_expenses').where({id:profile.id}).update({next_run_date:next,status:next?'active':'completed',last_error:null,version:Number(profile.version)+1,updated_at:new Date()});return created;
   });result.created+=count;
  }catch(error:any){const message=String(error.message||error).slice(0,1000);await db('acc_recurring_expenses').where({id:selected.id,branchid:this.branchId}).update({last_error:message});result.errors.push({profileId:Number(selected.id),message});}}
  return result;
 }
}
const active=new Set<number>();
export async function processDueRecurringExpenses(tenantId:number){if(active.has(tenantId))return;active.add(tenantId);try{const db=await KnexConnection(tenantId);const branches=await db('acc_recurring_expenses').where({status:'active'}).where('next_run_date','<=',today()).distinct('branchid');for(const row of branches)await new RecurringExpenseService(tenantId,Number(row.branchid)).runDue();}finally{active.delete(tenantId);}}
