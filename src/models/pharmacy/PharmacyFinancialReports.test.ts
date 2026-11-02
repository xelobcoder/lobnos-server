import {describe,it,expect} from 'vitest';
import {accountGroup,statementRows,pharmacyCashFlowSection} from './PharmacyFinancialReports';
const balance=(account:string,debit:number,credit:number)=>({account,debit,credit});
describe('pharmacy financial statements',()=>{
 it('classifies supported cash flows without guessing a compound or unknown allocation',()=>{
 expect(pharmacyCashFlowSection(['collection:1','sales','cost_of_sales','inventory'])).toBe('Operating activities');
 expect(pharmacyCashFlowSection(['collection:1','asset:equipment'])).toBe('Investing activities');
 expect(pharmacyCashFlowSection(['collection:1','opening_equity'])).toBe('Financing activities');
 expect(pharmacyCashFlowSection(['collection:1','asset:equipment','opening_equity'])).toBe('Classification required');
 expect(pharmacyCashFlowSection(['collection:1','unknown'])).toBe('Classification required');
 expect(pharmacyCashFlowSection(['collection:1','liability:grni'])).toBe('Operating activities');
 expect(pharmacyCashFlowSection(['collection:1','liability:loan'])).toBe('Classification required');
 expect(accountGroup('liability:grni')).toBe('Liabilities');
 });
 it('shows net debit and credit balances rather than lifetime movements in the trial balance',()=>{
 const rows=statementRows([balance('collection:1',100,40),balance('sales',0,100),balance('operating_expenses',40,0)],'trial_balance');
 expect(rows.find(r=>r.account==='collection:1')).toMatchObject({debit:60,credit:0,movementDebit:100,movementCredit:40});
 expect(rows.reduce((sum,row)=>sum+row.debit,0)).toBe(100);
 expect(rows.reduce((sum,row)=>sum+row.credit,0)).toBe(100);
 });
 it('classifies assigned account categories without losing departmental adjustments',()=>{
 expect(accountGroup('expense:rent')).toBe('Expenses');expect(accountGroup('revenue:other')).toBe('Revenue');
 expect(accountGroup('asset:equipment')).toBe('Assets');expect(accountGroup('liability:tax')).toBe('Liabilities');expect(accountGroup('equity:allocation')).toBe('Equity');
 });
 it('includes cumulative earnings in equity without treating period income as assets',()=>{
 const rows=statementRows([balance('collection:1',150,0),balance('inventory',50,0),balance('opening_equity',0,100),balance('sales',0,120),balance('cost_of_sales',20,0)],'balance_sheet');
 expect(rows.find(r=>r.account==='retained_result')?.amount).toBe(100);
 const total=(section:string)=>rows.filter(r=>r.section===section).reduce((s,r)=>s+r.amount,0);
 expect(total('Assets')).toBe(total('Liabilities')+total('Equity'));
 expect(rows.some(r=>r.account==='sales')).toBe(false);
 });
 it('recognizes inventory count losses and gains in profit and loss',()=>{
 const rows=statementRows([balance('sales',0,100),balance('cost_of_sales',40,0),balance('inventory_adjustments',0,5),balance('collection:1',100,0)],'profit_loss');
 expect(rows.map(r=>r.account)).toEqual(['sales','cost_of_sales','inventory_adjustments']);
 expect(rows.find(r=>r.account==='inventory_adjustments')?.amount).toBe(-5);
 });
 it('classifies pharmacy transfers, quarantine, credit and supplier return balances',()=>{
 for(const code of ['stock_in_transit','interbranch_receivable:2','quarantine_inventory','receivable:3','supplier_returns_pending'])expect(accountGroup(code)).toBe('Assets');
 expect(accountGroup('interbranch_payable:7')).toBe('Liabilities');
 expect(accountGroup('unknown')).toBe('Unclassified');
 });
});
