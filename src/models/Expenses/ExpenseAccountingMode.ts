/** Missing configuration preserves legacy integrated behavior. */
export async function expenseAccountingEnabled(db:any, branchid?:number|null):Promise<boolean> {
 if(!db.schema?.hasColumn || !await db.schema.hasColumn('expense_control_settings','accounting_enabled'))return true;
 const local=branchid==null?null:await db('expense_control_settings').where({branchid}).first();
 const row=local || await db('expense_control_settings').whereNull('branchid').first();
 return row?.accounting_enabled!==false && row?.accounting_enabled!==0;
}
/** Freeze the mode on first accrual so toggling settings cannot invent or lose reversals. */
export async function expenseUsesAccounting(db:any, expenseId:number, initialize=false):Promise<boolean> {
 if(!db.schema?.hasColumn || !await db.schema.hasColumn('expensesrecord','accounting_integrated'))return true;
 const expense=await db('expensesrecord').where({id:expenseId}).first();
 if(!expense)return true;
 if(expense.accounting_integrated!=null)return Boolean(expense.accounting_integrated);
 if(!initialize)return true;
 const enabled=await expenseAccountingEnabled(db,expense.branchid);
 await db('expensesrecord').where({id:expenseId}).whereNull('accounting_integrated').update({accounting_integrated:enabled});
 return enabled;
}
