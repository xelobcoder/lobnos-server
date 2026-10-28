import KnexConnection from '../../database/KnexConnections';
import { AccountingError } from '../errors/AccountingErrors';
import { minorUnits, sumMinor } from '../utils/money';
import { dateOnly } from '../utils/recurrence';
import { parsePaging } from '../utils/pagination';
export class BudgetService {
 constructor(private tenantId:number,private branchId:number){}
 private async db(){return KnexConnection(this.tenantId);}
 async list(query:any={}){const db=await this.db(),paging=parsePaging(query);const base=db('acc_budgets').where({branchid:this.branchId});if(query.year)base.where('year',Number(query.year));const total=await base.clone().count('* as total').first();return{data:await base.orderBy('year','desc').orderBy('id','desc').limit(paging.count).offset(paging.offset),total:Number(total?.total||0),page:paging.page,count:paging.count};}
 async save(input:any,employeeId:number,id?:number){
  const name=String(input.name||'').trim(),year=Number(input.year);
  if(!name||name.length>120||!Number.isInteger(year)||year<2000||year>2100||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>250)throw new AccountingError('Enter a budget name, year and at least one account','INVALID_BUDGET',400);
  const codes=input.lines.map((line:any)=>String(line.accountCode));if(new Set(codes).size!==codes.length)throw new AccountingError('An account can appear only once','DUPLICATE_BUDGET_ACCOUNT',400);
  const db=await this.db();return db.transaction(async(trx:any)=>{
   const previous=id?await trx('acc_budgets').where({id,branchid:this.branchId}).forUpdate().first():null;
   if(id&&!previous)throw new AccountingError('Budget not found','BUDGET_NOT_FOUND',404);
   if(previous&&(Number(input.version)!==Number(previous.version)||previous.status==='archived'))throw new AccountingError('This budget changed or is archived. Reload it before editing.','BUDGET_CHANGED',409);
   const previousLines=previous?await trx('acc_budget_lines').where({budget_id:id}):[];
   const accounts=await trx('acc_accounts').whereIn('account_code',codes).where({is_active:true}).whereIn('type',['revenue','expense']);
   if(accounts.length!==codes.length)throw new AccountingError('Choose active income or expense accounts','INVALID_BUDGET_ACCOUNT',400);
   const lines=input.lines.flatMap((line:any)=>{if(!Array.isArray(line.months)||line.months.length!==12)throw new AccountingError('Enter all twelve monthly amounts','INVALID_BUDGET',400);return line.months.map((value:any,index:number)=>{const amount=minorUnits(value);if(amount<0)throw new AccountingError('Budget targets cannot be negative','INVALID_BUDGET',400);return{account_code:String(line.accountCode),month:index+1,amount:amount/100};});});
   sumMinor(lines.map((line:any)=>line.amount));
   let budgetId=id;const after={name,year,branchid:this.branchId,status:'active',version:Number(previous?.version||0)+1,updated_by:employeeId,updated_at:new Date()};
   if(previous)await trx('acc_budgets').where({id}).update(after);else{const inserted=await trx('acc_budgets').insert({...after,created_by:employeeId,created_at:new Date()});budgetId=Number(inserted[0]);}
   await trx('acc_budget_lines').where({budget_id:budgetId}).delete();await trx('acc_budget_lines').insert(lines.map((line:any)=>({...line,budget_id:budgetId})));
   await trx('acc_control_audit').insert({action:'budget_saved',entity_id:budgetId,employee_id:employeeId,before_state:JSON.stringify(previous?{...previous,lines:previousLines}:{}),after_state:JSON.stringify({...after,lines}),created_at:new Date()});
   return{...after,id:budgetId};
  });
 }
 async archive(id:number,version:number,employeeId:number){const db=await this.db();return db.transaction(async(trx:any)=>{const before=await trx('acc_budgets').where({id,branchid:this.branchId}).forUpdate().first();if(!before)throw new AccountingError('Budget not found','BUDGET_NOT_FOUND',404);if(Number(before.version)!==version)throw new AccountingError('Reload this budget before archiving','BUDGET_CHANGED',409);await trx('acc_budgets').where({id}).update({status:'archived',version:version+1,updated_by:employeeId,updated_at:new Date()});await trx('acc_control_audit').insert({action:'budget_archived',entity_id:id,employee_id:employeeId,before_state:JSON.stringify(before),after_state:JSON.stringify({status:'archived'}),created_at:new Date()});return{archived:true};});}
 async detail(id:number){const db=await this.db();return db.transaction(async(trx:any)=>{
  const budget=await trx('acc_budgets').where({id,branchid:this.branchId}).first();if(!budget)throw new AccountingError('Budget not found','BUDGET_NOT_FOUND',404);
  const targets=await trx('acc_budget_lines as b').join('acc_accounts as a','a.account_code','b.account_code').where('b.budget_id',id).select('b.*','a.name','a.type');
  const actuals=await trx('acc_journal_lines as l').join('acc_journal_entries as e','e.id','l.journal_entry_id').join('acc_accounts as a','a.id','l.account_id')
   .where('l.branchid',this.branchId).whereNot('e.status','voided').whereNot('e.source_table','acc_year_close').whereIn('a.type',['revenue','expense']).whereRaw('DATE(e.occurred_at) BETWEEN ? AND ?',[`${budget.year}-01-01`,`${budget.year}-12-31`]).select('a.account_code','a.name','a.type','l.direction','l.amount','e.occurred_at');
  const rows=new Map<string,any>();const get=(code:string,name:string,type:string)=>{if(!rows.has(code))rows.set(code,{accountCode:code,name,type,budget:Array(12).fill(0),actual:Array(12).fill(0),budgeted:false});return rows.get(code);};
  for(const line of targets){const row=get(line.account_code,line.name,line.type);row.budget[Number(line.month)-1]=minorUnits(line.amount);row.budgeted=true;}
  for(const line of actuals){const month=Number(dateOnly(line.occurred_at).slice(5,7))-1;get(line.account_code,line.name,line.type).actual[month]+=minorUnits(line.amount)*(line.direction===(line.type==='revenue'?'credit':'debit')?1:-1);}
  const mapped=[...rows.values()].map(row=>({...row,budget:row.budget.map((n:number)=>n/100),actual:row.actual.map((n:number)=>n/100),budgetTotal:row.budget.reduce((a:number,b:number)=>a+b,0)/100,actualTotal:row.actual.reduce((a:number,b:number)=>a+b,0)/100,variance:row.actual.map((n:number,i:number)=>(n-row.budget[i])*(row.type==='expense'?-1:1)/100)}));
  const monthly=Array.from({length:12},(_,index)=>{const total=(kind:string,field:string)=>sumMinor(mapped.filter(row=>row.type===kind).map(row=>row[field][index]))/100;const incomeBudget=total('revenue','budget'),expenseBudget=total('expense','budget'),incomeActual=total('revenue','actual'),expenseActual=total('expense','actual');return{month:index+1,incomeBudget,expenseBudget,incomeActual,expenseActual,profitBudget:(minorUnits(incomeBudget)-minorUnits(expenseBudget))/100,profitActual:(minorUnits(incomeActual)-minorUnits(expenseActual))/100};});
  return{budget,rows:mapped,monthly,basis:'accrual',varianceConvention:'Positive means favourable: actual minus budget for income; budget minus actual for expenses.'};
 },{isolationLevel:'repeatable read'});}
}
