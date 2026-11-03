import {money} from './PharmacyRules';
import {pharmacyAccountDisplay} from './PharmacyAccountDisplay';
export const financialReports=['profit_loss','balance_sheet','cash_flow','trial_balance','transactions'];
export function accountGroup(code:string):string {
 if(['sales','sales_returns','sales_discounts'].includes(code)||code.startsWith('revenue:'))return 'Revenue';
 if(['cost_of_sales','operating_expenses','inventory_adjustments'].includes(code)||code.startsWith('expense:'))return 'Expenses';
 if(code==='opening_equity'||code.startsWith('equity:'))return 'Equity';
 if(code.startsWith('payable:')||code.startsWith('liability:')||code==='supplier_payable'||code==='interbranch_payable'||code.startsWith('interbranch_payable:'))return 'Liabilities';
 if(code.startsWith('collection:')||code.startsWith('asset:')||code.startsWith('receivable:')||code.startsWith('interbranch_receivable:')||['inventory','quarantine_inventory','inventory_in_transit','stock_in_transit','supplier_returns_pending','interbranch_receivable'].includes(code))return 'Assets';
 return 'Unclassified';
}
export function statementRows(balances:any[],report:string){
 const rows=balances.map(row=>{const group=accountGroup(row.account);return {...row,section:group,amount:money((['Revenue','Liabilities','Equity'].includes(group)?-1:1)*(Number(row.debit)-Number(row.credit)))};});
 if(report==='profit_loss')return rows.filter(row=>['Revenue','Expenses'].includes(row.section));
 if(report==='balance_sheet'){
 const result=rows.filter(row=>!['Revenue','Expenses'].includes(row.section));
 const profit=money(rows.reduce((sum,row)=>sum+(row.section==='Revenue'?row.amount:row.section==='Expenses'?-row.amount:0),0));
 if(profit)result.push({account:'retained_result',section:'Equity',amount:profit,debit:0,credit:0});
 return result;
 }
 if(report==='trial_balance')return rows.map(row=>({...row,movementDebit:Number(row.debit),movementCredit:Number(row.credit),debit:money(Math.max(0,Number(row.debit)-Number(row.credit))),credit:money(Math.max(0,Number(row.credit)-Number(row.debit)))}));
 return rows;
}
const statementOrder:Record<string,string[]>={
 profit_loss:['Revenue','Cost of sales','Operating expenses','Other income','Other expenses'],
 balance_sheet:['Assets','Liabilities','Equity','Unclassified'],
 trial_balance:['Assets','Liabilities','Equity','Revenue','Expenses','Unclassified'],
};
// Presents classified rows in conventional statement order; totals must be computed before this runs.
export function presentStatementRows(rows:any[],report:string){
 const order=statementOrder[report];
 if(!order)return rows;
 const section=(row:any)=>{
  if(report!=='profit_loss')return row.section;
  const code=String(row.account);
  if(row.section==='Revenue')return code==='revenue:other'||code.startsWith('revenue:other:')?'Other income':'Revenue';
  if(code==='cost_of_sales')return 'Cost of sales';
  return code==='expense:other'||code.startsWith('expense:other:')?'Other expenses':'Operating expenses';
 };
 const rank=(value:string)=>{const index=order.indexOf(value);return index<0?order.length:index;};
 return rows.map(row=>({...row,section:section(row)})).sort((a,b)=>rank(a.section)-rank(b.section)
  ||String(a.account_number??'~').localeCompare(String(b.account_number??'~'),undefined,{numeric:true})
  ||String(a.account_name??a.account).localeCompare(String(b.account_name??b.account)));
}
const journalTypes:Record<string,string>={sale:'Sales invoice',refund:'Sales refund',receipt:'Stock purchase',expense:'Expense',goods_acceptance:'Goods received note',supplier_invoice:'Supplier invoice',receivable_collection:'Customer receipt',receivable_adjustment:'Receivable adjustment',supplier_settlement:'Supplier payment'};
export function journalTypeLabel(kind:unknown){
 const value=String(kind??'');
 if(journalTypes[value])return journalTypes[value];
 const words=value.replace(/[_:-]+/g,' ').trim();
 return words?words.charAt(0).toUpperCase()+words.slice(1):'Journal';
}
export function pharmacyCashFlowSection(accounts:string[],operatingLiabilities:string[]=[]):string {
 const groups=new Set(accounts.filter(code=>!code.startsWith('collection:')).map(code=>{
 if(code==='opening_equity'||code.startsWith('equity:'))return 'Financing activities';
 if(code.startsWith('asset:'))return 'Investing activities';
 if(['Revenue','Expenses'].includes(accountGroup(code))||code.startsWith('receivable:')||code.startsWith('payable:')||code==='liability:grni'||operatingLiabilities.includes(code)||['inventory','quarantine_inventory','inventory_in_transit','stock_in_transit','supplier_returns_pending'].includes(code))return 'Operating activities';
 return 'Classification required';
 }));
 return groups.size===1?[...groups][0]:'Classification required';
}
export async function pharmacyFinancialReport(db:any,branch:number,f:any,all:boolean){
 const base=()=>db('pharmacy_journal_lines as l').join('pharmacy_journals as j','j.id','l.journal_id').where('j.branchid',branch);
 const period=()=>base().where('j.financial_date','>=',f.from).where('j.financial_date','<=',f.to);
 const col=(key:string,label:string,format?:string)=>({key,label,format});
 const columns=[col('section','Section'),col('account_number','Account no.'),col('account_name','Account'),col('amount','Amount (GHS)','money')];
 let rows:any[]=[],totals:any={};
 if(f.report==='transactions'){
 const q=period().select('j.id','j.financial_date as date','j.source_ref as reference','j.kind','j.description','l.account_code as account','l.debit','l.credit').orderBy('j.financial_date','desc').orderBy('j.id');
 if(f.search)q.where((b:any)=>b.where('j.description','like','%'+f.search+'%').orWhere('j.source_ref','like','%'+f.search+'%').orWhere('l.account_code','like','%'+f.search+'%'));
 const total=await db.from(q.clone().clearOrder().as('transactions')).count('* as total').first();
 if(all&&Number(total?.total||0)>10000)throw new Error('Journal exports are limited to 10,000 rows. Narrow the date range');
 rows=await (all?q.limit(10000):q.limit(f.count).offset((f.page-1)*f.count));
 const display=await pharmacyAccountDisplay(db,branch,[...new Set(rows.map((r:any)=>String(r.account)))]);
 rows=rows.map((r:any)=>({...r,type:journalTypeLabel(r.kind),account_number:display.get(r.account)?.number??null,account_name:display.get(r.account)?.name}));
 return {rows,total:Number(total?.total||0),totalPages:Math.max(1,Math.ceil(Number(total?.total||0)/f.count)),page:f.page,count:f.count,columns:[col('date','Date','date'),col('reference','Reference'),col('type','Transaction type'),col('description','Description'),col('account_number','Account no.'),col('account_name','Account'),col('debit','Debit','money'),col('credit','Credit','money')],totals};
 }
 if(f.report==='cash_flow'){
 const cash=(q:any)=>q.where('l.account_code','like','collection:%');
 const [opening,closing,movements]=await Promise.all([cash(base()).where('j.financial_date','<',f.from).sum('l.debit as debit').sum('l.credit as credit').first(),cash(base()).where('j.financial_date','<=',f.to).sum('l.debit as debit').sum('l.credit as credit').first(),cash(period()).select('j.id','j.financial_date as date','j.kind','j.description').sum('l.debit as inflow').sum('l.credit as outflow').groupBy('j.id','j.financial_date','j.kind','j.description').orderBy('j.financial_date').limit(10001)]);
 if(movements.length>10000)throw new Error('Cash-flow reports are limited to 10,000 journals. Narrow the date range');
 const counterpartLines=movements.length?await db('pharmacy_journal_lines').whereIn('journal_id',movements.map((r:any)=>r.id)).select('journal_id','account_code'):[];
 const taxAccounts=await db('pharmacy_tax_events').where({branchid:branch}).where('financial_date','<=',f.to).distinct('local_account');
 rows=movements.map((r:any)=>{
 const net=money(Number(r.inflow)-Number(r.outflow));
 return {...r,type:journalTypeLabel(r.kind),section:net===0?'Internal transfers':pharmacyCashFlowSection(counterpartLines.filter((line:any)=>line.journal_id===r.id).map((line:any)=>line.account_code),taxAccounts.map((tax:any)=>tax.local_account)),inflow:Math.max(0,net),outflow:Math.max(0,-net),net};
 });
 const net=(r:any)=>money(Number(r?.debit||0)-Number(r?.credit||0));totals={openingCash:net(opening),inflows:money(rows.reduce((s,r)=>s+Number(r.inflow),0)),outflows:money(rows.reduce((s,r)=>s+Number(r.outflow),0)),closingCash:net(closing)};totals.reconciliationDifference=money(totals.openingCash+totals.inflows-totals.outflows-totals.closingCash);
 for(const [key,section] of [['operatingCashFlow','Operating activities'],['investingCashFlow','Investing activities'],['financingCashFlow','Financing activities'],['unclassifiedCashFlow','Classification required']])totals[key]=money(rows.filter(r=>r.section===section).reduce((sum,r)=>sum+r.net,0));
 return {rows,total:rows.length,totalPages:1,page:1,count:rows.length,totals,classificationIssues:rows.filter(r=>r.section==='Classification required').map(r=>({journalId:r.id,description:r.description,amount:r.net})),columns:[col('section','Activity'),col('date','Date','date'),col('type','Transaction type'),col('description','Description'),col('inflow','Cash in','money'),col('outflow','Cash out','money'),col('net','Net movement','money')]};
 }
 const q=f.report==='profit_loss'?period():base().where('j.financial_date','<=',f.to);
 const balances=await q.select('l.account_code as account').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code').orderBy('l.account_code');
 rows=statementRows(balances,f.report);
 const names=await pharmacyAccountDisplay(db,branch,rows.map(row=>String(row.account)));
 rows=rows.map(row=>({...row,account_number:names.get(row.account)?.number??null,account_name:names.get(row.account)?.name}));
 const sum=(section:string)=>money(rows.filter(r=>r.section===section).reduce((s,r)=>s+r.amount,0));
 if(f.report==='profit_loss'){
 const costOfSales=money(rows.filter(r=>r.account==='cost_of_sales').reduce((s,r)=>s+r.amount,0));
 const otherIncome=money(rows.filter(r=>r.account==='revenue:other'||r.account.startsWith('revenue:other:')).reduce((s,r)=>s+r.amount,0));
 const otherExpenses=money(rows.filter(r=>r.account==='expense:other'||r.account.startsWith('expense:other:')).reduce((s,r)=>s+r.amount,0));
 const netSales=money(sum('Revenue')-otherIncome),operatingExpenses=money(sum('Expenses')-costOfSales-otherExpenses);
 const salesReturns=money(rows.filter(r=>r.account==='sales').reduce((s,r)=>s+Number(r.debit),0)-rows.filter(r=>['sales_returns','revenue:credits'].includes(r.account)).reduce((s,r)=>s+r.amount,0));
 const salesDiscounts=money(-rows.filter(r=>['sales_discounts','revenue:discounts'].includes(r.account)).reduce((s,r)=>s+r.amount,0));
 totals={revenue:sum('Revenue'),salesRevenue:money(netSales+salesReturns+salesDiscounts),salesReturns,salesDiscounts,netSales,costOfSales,grossProfit:money(netSales-costOfSales),operatingExpenses,expenses:sum('Expenses'),operatingProfit:money(netSales-costOfSales-operatingExpenses),otherIncome,otherExpenses,netProfit:money(sum('Revenue')-sum('Expenses'))};
 }
 else if(f.report==='balance_sheet')totals={assets:sum('Assets'),liabilities:sum('Liabilities'),equity:sum('Equity'),unclassified:sum('Unclassified'),balanceDifference:money(sum('Assets')-sum('Liabilities')-sum('Equity'))};
 else{totals={debits:money(rows.reduce((s:any,r:any)=>s+Number(r.debit),0)),credits:money(rows.reduce((s:any,r:any)=>s+Number(r.credit),0))};totals.difference=money(totals.debits-totals.credits);columns.splice(0,columns.length,col('section','Classification'),col('account_number','Account no.'),col('account_name','Account'),col('debit','Debit','money'),col('credit','Credit','money'));}
 rows=presentStatementRows(rows,f.report);
 return {rows,total:rows.length,page:1,count:rows.length,totalPages:1,columns,totals};
}
