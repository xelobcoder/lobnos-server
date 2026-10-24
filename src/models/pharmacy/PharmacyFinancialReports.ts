import {money} from './PharmacyRules';
export const financialReports=['profit_loss','balance_sheet','cash_flow','trial_balance','transactions'];
export function accountGroup(code:string):string {
 if(code==='sales')return 'Revenue';
 if(['cost_of_sales','operating_expenses','inventory_adjustments'].includes(code))return 'Expenses';
 if(code==='opening_equity')return 'Equity';
 if(code.startsWith('payable:')||code==='interbranch_payable'||code.startsWith('interbranch_payable:'))return 'Liabilities';
 if(code.startsWith('collection:')||code.startsWith('receivable:')||code.startsWith('interbranch_receivable:')||['inventory','quarantine_inventory','inventory_in_transit','stock_in_transit','supplier_returns_pending','interbranch_receivable'].includes(code))return 'Assets';
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
 return rows;
}
export async function pharmacyFinancialReport(db:any,branch:number,f:any,all:boolean){
 const base=()=>db('pharmacy_journal_lines as l').join('pharmacy_journals as j','j.id','l.journal_id').where('j.branchid',branch);
 const period=()=>base().where('j.financial_date','>=',f.from).where('j.financial_date','<=',f.to);
 const col=(key:string,label:string,format?:string)=>({key,label,format});
 const columns=[col('section','Section'),col('account','Account'),col('amount','Amount (GHS)','money')];
 let rows:any[]=[],totals:any={};
 if(f.report==='transactions'){
 const q=period().select('j.id','j.financial_date as date','j.source_ref as reference','j.kind','j.description','l.account_code as account','l.debit','l.credit').orderBy('j.financial_date','desc').orderBy('j.id');
 if(f.search)q.where((b:any)=>b.where('j.description','like','%'+f.search+'%').orWhere('j.source_ref','like','%'+f.search+'%').orWhere('l.account_code','like','%'+f.search+'%'));
 const total=await db.from(q.clone().clearOrder().as('transactions')).count('* as total').first();
 rows=await (all?q:q.limit(f.count).offset((f.page-1)*f.count));
 return {rows,total:Number(total?.total||0),totalPages:Math.max(1,Math.ceil(Number(total?.total||0)/f.count)),page:f.page,count:f.count,columns:[col('date','Date','date'),col('reference','Reference'),col('kind','Type'),col('description','Description'),col('account','Account'),col('debit','Debit','money'),col('credit','Credit','money')],totals};
 }
 if(f.report==='cash_flow'){
 const cash=(q:any)=>q.where('l.account_code','like','collection:%');
 const [opening,closing,movements]=await Promise.all([cash(base()).where('j.financial_date','<',f.from).sum('l.debit as debit').sum('l.credit as credit').first(),cash(base()).where('j.financial_date','<=',f.to).sum('l.debit as debit').sum('l.credit as credit').first(),cash(period()).select('j.id','j.financial_date as date','j.kind','j.description').sum('l.debit as inflow').sum('l.credit as outflow').groupBy('j.id','j.financial_date','j.kind','j.description').orderBy('j.financial_date')]);
 rows=movements.map((r:any)=>({...r,net:money(Number(r.inflow)-Number(r.outflow))}));
 const net=(r:any)=>money(Number(r?.debit||0)-Number(r?.credit||0));totals={openingCash:net(opening),inflows:money(rows.reduce((s,r)=>s+Number(r.inflow),0)),outflows:money(rows.reduce((s,r)=>s+Number(r.outflow),0)),closingCash:net(closing)};totals.reconciliationDifference=money(totals.openingCash+totals.inflows-totals.outflows-totals.closingCash);
 return {rows,total:rows.length,totalPages:1,page:1,count:rows.length,totals,columns:[col('date','Date','date'),col('kind','Type'),col('description','Description'),col('inflow','Cash in','money'),col('outflow','Cash out','money'),col('net','Net movement','money')]};
 }
 const q=f.report==='profit_loss'?period():base().where('j.financial_date','<=',f.to);
 const balances=await q.select('l.account_code as account').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code').orderBy('l.account_code');
 rows=statementRows(balances,f.report);
 const sum=(section:string)=>money(rows.filter(r=>r.section===section).reduce((s,r)=>s+r.amount,0));
 if(f.report==='profit_loss')totals={revenue:sum('Revenue'),expenses:sum('Expenses'),netProfit:money(sum('Revenue')-sum('Expenses'))};
 else if(f.report==='balance_sheet')totals={assets:sum('Assets'),liabilities:sum('Liabilities'),equity:sum('Equity'),unclassified:sum('Unclassified'),balanceDifference:money(sum('Assets')-sum('Liabilities')-sum('Equity'))};
 else{totals={debits:money(balances.reduce((s:any,r:any)=>s+Number(r.debit),0)),credits:money(balances.reduce((s:any,r:any)=>s+Number(r.credit),0))};totals.difference=money(totals.debits-totals.credits);columns.splice(0,columns.length,col('section','Section'),col('account','Account'),col('debit','Debit','money'),col('credit','Credit','money'));}
 return {rows,total:rows.length,page:1,count:rows.length,totalPages:1,columns,totals};
}
