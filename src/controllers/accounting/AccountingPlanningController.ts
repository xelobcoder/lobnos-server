import { Request,Response,Router } from 'express';
import { getAuthUser,requireAuthority } from '../../middleware/authority';
import { BudgetService } from '../../accountingModule/services/BudgetService';
import { RecurringExpenseService } from '../../accountingModule/services/RecurringExpenseService';
import { CashForecastService } from '../../accountingModule/services/CashForecastService';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
function actor(req:Request){const user=getAuthUser(req);if(!user)throw new AccountingError('Authentication required','UNAUTHENTICATED',401);if(!Number.isSafeInteger(Number(user.branch))||Number(user.branch)<=0)throw new AccountingError('Select an active branch before opening accounting planning','BRANCH_REQUIRED',400);return{...user,branch:Number(user.branch)};}
function handler(action:(req:Request)=>Promise<any>){return async(req:Request,res:Response)=>{try{res.json({status:'success',statusCode:200,result:await action(req)});}catch(error:any){res.status(error instanceof AccountingError?error.statusCode:500).json({status:'error',message:error.message||'Accounting planning request failed',code:error.code});}};}
function id(req:Request){const value=Number(req.params.id);if(!Number.isSafeInteger(value)||value<=0)throw new AccountingError('A valid record ID is required','INVALID_ID',400);return value;}
export const accountingPlanningRouter=Router();
accountingPlanningRouter.get('/api/v1/accounting/budgets',handler(req=>{const a=actor(req);return new BudgetService(a.tenantId,a.branch).list(req.query);}));
accountingPlanningRouter.get('/api/v1/accounting/budgets/:id',handler(req=>{const a=actor(req);return new BudgetService(a.tenantId,a.branch).detail(id(req));}));
accountingPlanningRouter.post('/api/v1/accounting/budgets',requireAuthority('accounting.journal.post'),handler(req=>{const a=actor(req);return new BudgetService(a.tenantId,a.branch).save(req.body,a.employeeid);}));
accountingPlanningRouter.put('/api/v1/accounting/budgets/:id',requireAuthority('accounting.journal.post'),handler(req=>{const a=actor(req);return new BudgetService(a.tenantId,a.branch).save(req.body,a.employeeid,id(req));}));
accountingPlanningRouter.post('/api/v1/accounting/budgets/:id/archive',requireAuthority('accounting.journal.post'),handler(req=>{const a=actor(req);return new BudgetService(a.tenantId,a.branch).archive(id(req),Number(req.body.version),a.employeeid);}));
accountingPlanningRouter.get('/api/v1/accounting/recurring-expenses/options',handler(req=>{const a=actor(req);return new RecurringExpenseService(a.tenantId,a.branch).options(String(req.query.search||''));}));
accountingPlanningRouter.get('/api/v1/accounting/recurring-expenses/:id/occurrences',handler(req=>{const a=actor(req);return new RecurringExpenseService(a.tenantId,a.branch).history(id(req),req.query);}));
accountingPlanningRouter.get('/api/v1/accounting/recurring-expenses',handler(req=>{const a=actor(req);return new RecurringExpenseService(a.tenantId,a.branch).list(req.query);}));
accountingPlanningRouter.post('/api/v1/accounting/recurring-expenses',requireAuthority('expense.create'),handler(req=>{const a=actor(req);return new RecurringExpenseService(a.tenantId,a.branch).save(req.body,a.employeeid);}));
accountingPlanningRouter.put('/api/v1/accounting/recurring-expenses/:id',requireAuthority('expense.create'),handler(req=>{const a=actor(req);return new RecurringExpenseService(a.tenantId,a.branch).save(req.body,a.employeeid,id(req));}));
accountingPlanningRouter.post('/api/v1/accounting/recurring-expenses/run-due',requireAuthority('expense.create'),handler(req=>{const a=actor(req);return new RecurringExpenseService(a.tenantId,a.branch).runDue();}));
accountingPlanningRouter.post('/api/v1/accounting/cash-flow-forecast',handler(req=>{const a=actor(req);return new CashForecastService(a.tenantId,a.branch).report(req.body);}));
