import KnexConnection from '../../database/KnexConnections';
import { parsePaging, parseSort, paginate } from '../utils/pagination';
import {
     AgingBucket,
     BalanceSheet,
     BranchPerformanceRow,
     CashFlowLine,
     CashFlowStatement,
     IAccountingReportService,
     IncomeStatement,
     FinancialOverview,
     InventoryValuation,
     LedgerLine,
     PeriodBreakdownRow,
     TrialBalanceRow,
} from '../interfaces/IAccountingReportService';

import { AccountingPeriodService } from './AccountingPeriodService';
import { FinancialFinalizationGuard } from './FinancialFinalizationGuard';
import { AccountingError } from '../errors/AccountingErrors';
import { minorUnits, sumMinor } from '../utils/money';
import { CashFlowReviewInput, cashFlowReview, readCashFlowReview } from '../utils/cashFlow';
import { inventoryValuation } from './InventoryValuationService';

const COST_OF_SALES_CODES = ['acc-5000'];
const GENERAL_LEDGER_SORT_COLUMNS = [
     'e.occurred_at',
     'e.id',
     'e.transaction_type',
     'e.source_module',
     'a.account_code',
     'l.amount',
     'l.direction',
];
const CASH_ACCOUNTS = ['acc-1000', 'acc-1001'];
const INVENTORY_ACCOUNT = 'acc-1003';
const INVESTING_CODES = ['acc-1006', 'acc-1007'];
const FINANCING_CODES = ['acc-2001', 'acc-3000', 'acc-3001'];

interface ControlEvent {
     id: number;
     reference: string;
     partyId: string | number | null;
     partyType: string;
     partyName: string | null;
     patientIdentifier: string | null;
     documentDate: string;
     amount: number;
     source_table: string;
     source_ref: string;
     branchId: number;
}

interface PharmacySupplierUse {
     source_id: string; bill_id: string; branchid: number; amount: string | number;
     journal_id: string; supplier_id: string; source_branch: number; source_amount: string | number;
     bill_branch: number; bill_supplier: string; bill_ref: string; bill_date: string | Date;
}

export class AccountingReportService implements IAccountingReportService {
     constructor(private tenantId: number, private trx?: any) { }

     private async connection() {
          return this.trx || KnexConnection(this.tenantId);
     }

     async financialOverview(asOf: string, options: { branchId?: number } = {}): Promise<FinancialOverview> {
          if (!this.trx) { const db = await this.connection(); return db.transaction((trx: any) => new AccountingReportService(this.tenantId, trx).financialOverview(asOf, options), { isolationLevel: 'repeatable read' }); }
          const date = asOf || new Date().toISOString().split('T')[0];
          const monthStart = `${date.slice(0, 7)}-01`;
          const yearStart = `${date.slice(0, 4)}-01-01`;
          const branchId = options.branchId;
          const db = await this.connection();

          const [today, monthToDate, yearToDate, balanceSheet, receivables, payables, trend, currentPeriod] = await Promise.all([
               this.incomeStatement(date, date, branchId),
               this.incomeStatement(monthStart, date, branchId),
               this.incomeStatement(yearStart, date, branchId),
               this.balanceSheet(date, branchId),
               this.receivableAging(date, branchId),
               this.payableAging(date, branchId),
               this.monthlyTrend(yearStart, date, branchId),
               db('acc_periods').where('period_start', '<=', date).where('period_end', '>=', date).first(),
          ]);

          const accountBalance = (code: string) => balanceSheet.assets.concat(balanceSheet.liabilities, balanceSheet.equity)
               .find((row) => row.account_code === code)?.balance || 0;
          const cash = round2(accountBalance('acc-1000'));
          const bank = sumMinor((await this.cashAccountCodes()).filter(code => code !== 'acc-1000').map(accountBalance)) / 100;
          const inventory = round2(accountBalance(INVENTORY_ACCOUNT));
          const fixedAssets = round2(accountBalance('acc-1006') + accountBalance('acc-1007'));

          return {
               asOf: date,
               period: { from: yearStart, to: date, code: currentPeriod?.period_code || date.slice(0, 7), status: currentPeriod?.status || null },
               performance: {
                    today: performanceTotals(today),
                    monthToDate: performanceTotals(monthToDate),
                    yearToDate: performanceTotals(yearToDate),
               },
               position: {
                    cash,
                    bank,
                    cashAndBank: round2(cash + bank),
                    receivables: round2(receivables.totals.total),
                    overdueReceivables: round2(receivables.totals.days90 + receivables.totals.over90),
                    payables: round2(payables.totals.total),
                    overduePayables: round2(payables.totals.days90 + payables.totals.over90),
                    inventory,
                    fixedAssets,
                    totalAssets: round2(balanceSheet.totals.assets),
                    totalLiabilities: round2(balanceSheet.totals.liabilities),
                    equity: round2(balanceSheet.totals.equity + balanceSheet.totals.retainedProfit),
                    netAssets: round2(balanceSheet.totals.assets - balanceSheet.totals.liabilities),
                    balanceDifference: round2(balanceSheet.totals.difference),
               },
               accountSnapshot: [...balanceSheet.assets,...balanceSheet.liabilities,...balanceSheet.equity,...yearToDate.revenue,...yearToDate.costOfSales,...yearToDate.operatingExpenses].map(row=>({accountCode:row.account_code,name:row.name,type:row.type,normalBalance:row.normal_balance,balance:row.balance,basis:['revenue','expense'].includes(row.type)?'yearToDate':'asOf'})),
               expenseBreakdown: [...yearToDate.costOfSales,...yearToDate.operatingExpenses].map(row=>({accountCode:row.account_code,name:row.name,amount:row.balance})),
               trend,
          };
     }

     private async monthlyTrend(from: string, to: string, branchId?: number) {
          const [revenue, expense] = await Promise.all([
               this.periodBreakdown('revenue', from, to, branchId),
               this.periodBreakdown('expense', from, to, branchId),
          ]);
          const periods:string[]=[];const cursor=new Date(`${from.slice(0,7)}-01T00:00:00Z`);while(cursor.toISOString().slice(0,7)<=to.slice(0,7)){periods.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
          return {
               periods,
               revenue: periods.map((period) => round2(revenue.totals[period] || 0)),
               expenses: periods.map((period) => round2(expense.totals[period] || 0)),
               profit: periods.map((period) => round2((revenue.totals[period] || 0) - (expense.totals[period] || 0))),
          };
     }

     async trialBalance(
          from?: string,
          to?: string,
          branchId?: number
     ): Promise<{ rows: TrialBalanceRow[]; totals: { debits: number; credits: number; balanced: boolean } }> {
          const rows = await this.accountBalances({ from, to, branchId });

          const debits = round2(rows.reduce((total, row) => total + row.debits, 0));
          const credits = round2(rows.reduce((total, row) => total + row.credits, 0));

          return { rows, totals: { debits, credits, balanced: debits === credits } };
     }

     async generalLedgerSummary(filters: { from?: string; to?: string; accountCode?: string; sourceModule?: string; branchId?: number }) {
          if (!this.trx) { const db = await this.connection(); return db.transaction((trx: any) => new AccountingReportService(this.tenantId,trx).generalLedgerSummary(filters), { isolationLevel:'repeatable read' }); }
          const db = await this.connection();
          const aggregate = async (opening: boolean) => {
               const q = db('acc_journal_lines as l').join('acc_journal_entries as e','e.id','l.journal_entry_id').join('acc_accounts as a','a.id','l.account_id').whereNot('e.status','voided');
               if (opening) { if (!filters.from) return []; q.whereRaw('DATE(e.occurred_at) < ?', [filters.from]); }
               else { if(filters.from) q.whereRaw('DATE(e.occurred_at) >= ?', [filters.from]); if(filters.to) q.whereRaw('DATE(e.occurred_at) <= ?', [filters.to]); }
               if(filters.branchId) q.where('l.branchid',filters.branchId);
               if(filters.sourceModule) q.where('e.source_module',filters.sourceModule);
               if(filters.accountCode) q.where('a.account_code',filters.accountCode);
               return q.groupBy('a.account_code').select('a.account_code',db.raw("SUM(CASE WHEN l.direction='debit' THEN l.amount ELSE -l.amount END) AS movement"),db.raw("SUM(CASE WHEN l.direction='debit' THEN l.amount ELSE 0 END) AS debits"),db.raw("SUM(CASE WHEN l.direction='credit' THEN l.amount ELSE 0 END) AS credits"));
          };
          const opening = new Map((await aggregate(true)).map((r:any)=>[r.account_code,r]));
          const movement = new Map((await aggregate(false)).map((r:any)=>[r.account_code,r]));
          const query = db('acc_accounts').orderBy('name'); if(filters.accountCode) query.where('account_code',filters.accountCode);
          const rows = (await query).map((a:any)=>{const o:any=opening.get(a.account_code), m:any=movement.get(a.account_code);const sign=a.normal_balance==='credit'?-1:1;return {accountCode:a.account_code,accountName:a.name,type:a.type,normalBalance:a.normal_balance,openingBalance:minorUnits(o?.movement||0)*sign/100,debits:Number(m?.debits||0),credits:Number(m?.credits||0),closingBalance:(minorUnits(o?.movement||0)+minorUnits(m?.movement||0))*sign/100};}).filter((r:any)=>r.openingBalance||r.debits||r.credits);
          return {rows,totals:{debits:sumMinor(rows.map((r:any)=>r.debits))/100,credits:sumMinor(rows.map((r:any)=>r.credits))/100},basis:'accrual'};
     }

     async generalLedger(filters: {
          from?: string;
          to?: string;
          accountCode?: string;
          sourceModule?: string;
          branchId?: number;
          page?: number;
          count?: number;
          sortby?: string;
     }): Promise<{ data: LedgerLine[]; total: number; page: number; count: number }> {
          const db = await this.connection();
          const paging = parsePaging(filters, 50);
          const sort = parseSort(filters, GENERAL_LEDGER_SORT_COLUMNS, { column: 'e.occurred_at', direction: 'desc' });

          const base = db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .where('e.status', '!=', 'voided');

          if (filters.from) base.whereRaw('DATE(e.occurred_at) >= ?', [filters.from]);
          if (filters.to) base.whereRaw('DATE(e.occurred_at) <= ?', [filters.to]);
          if (filters.accountCode) base.where('a.account_code', filters.accountCode);
          if (filters.sourceModule) base.where('e.source_module', filters.sourceModule);
          if (filters.branchId) base.where('l.branchid', filters.branchId);

          const totalRow = await base.clone().clearSelect().clearOrder().count('* as total').first();


          const data = await base
               .clone()
               .select(
                    'e.id as journal_entry_id',
                    'e.occurred_at',
                    'e.transaction_type',
                    'e.source_module',
                    'e.source_table',
                    'e.source_pk',
                    'e.source_ref',
                    'e.description',
                    'a.account_code',
                    'a.name as account_name',
                    'l.direction',
                    'l.amount',
                    'l.branchid',
                    'l.billingid',
                    'l.expense_id',
                    'l.invoice_id',
                    'l.employeeid'
               )
               .orderBy([{ column: sort.column, order: filters.sortby || sort.direction.toLowerCase() }, { column: 'e.id', order: 'desc' }])
               .limit(paging.count)
               .offset(paging.offset);

          return { data, total: Number(totalRow?.total || 0), page: paging.page, count: paging.count };
     }

     async incomeStatement(from: string, to: string, branchId?: number): Promise<IncomeStatement> {
          const rows = (await this.accountBalances({ from, to, branchId, excludeClosing: true })).map(presentationBalance);

          const revenue = rows.filter((row) => row.type === 'revenue');
          const expenses = rows.filter((row) => row.type === 'expense');
          const costOfSales = expenses.filter((row) => COST_OF_SALES_CODES.includes(row.account_code));
          const operatingExpenses = expenses.filter((row) => !COST_OF_SALES_CODES.includes(row.account_code));

          const revenueTotal = sumBalances(revenue);
          const costOfSalesTotal = sumBalances(costOfSales);
          const operatingExpensesTotal = sumBalances(operatingExpenses);
          const grossProfit = round2(revenueTotal - costOfSalesTotal);

          return {
               revenue,
               costOfSales,
               operatingExpenses,
               totals: {
                    revenue: revenueTotal,
                    costOfSales: costOfSalesTotal,
                    grossProfit,
                    operatingExpenses: operatingExpensesTotal,
                    netProfit: round2(grossProfit - operatingExpensesTotal),
               },
          };
     }

     async balanceSheet(asOf: string, branchId?: number): Promise<BalanceSheet> {
          const rows = (await this.accountBalances({ to: asOf, branchId })).map(presentationBalance);

          const assets = rows.filter((row) => row.type === 'asset');
          const liabilities = rows.filter((row) => row.type === 'liability');
          const equity = rows.filter((row) => row.type === 'equity');
          const revenueTotal = sumBalances(rows.filter((row) => row.type === 'revenue'));
          const expenseTotal = sumBalances(rows.filter((row) => row.type === 'expense'));

          const assetsTotal = sumBalances(assets);
          const liabilitiesTotal = sumBalances(liabilities);
          const equityTotal = sumBalances(equity);
          const retainedProfit = round2(revenueTotal - expenseTotal);
          const liabilitiesAndEquity = round2(liabilitiesTotal + equityTotal + retainedProfit);

          return {
               assets,
               liabilities,
               equity,
               totals: {
                    assets: assetsTotal,
                    liabilities: liabilitiesTotal,
                    equity: equityTotal,
                    retainedProfit,
                    liabilitiesAndEquity,
                    difference: round2(assetsTotal - liabilitiesAndEquity),
               },
          };
     }

     async receivableAging(asOf?: string, branchId?: number) { return this.controlAccountAging('AR', asOf, branchId); }
     async payableAging(asOf?: string, branchId?: number) { return this.controlAccountAging('AP', asOf, branchId); }

     private async controlEvents(ledger: 'AR' | 'AP', asOf?: string, branchId?: number) {
          const db = await this.connection();
          const cutoff = asOf || new Date().toISOString().slice(0, 10);
          const movements = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .where('a.account_code', ledger === 'AR' ? 'acc-1002' : 'acc-2000')
               .whereNot('e.status', 'voided').whereRaw('DATE(e.occurred_at) <= ?', [cutoff])
               .modify((query: any) => { if (branchId) query.where('l.branchid', branchId); })
               .select('l.*', 'e.occurred_at', 'e.source_table', 'e.source_pk', 'e.source_ref')
               .orderBy('e.occurred_at', 'asc').orderBy('l.id', 'asc');
          const metadata = await db('acc_subledger_entries').where({ ledger }).where('document_date', '<=', cutoff).select('*');
          const sources = new Map(metadata.map((row: any) => [`${row.source_table}:${row.source_ref}`, row]));
          const billIds = [...new Set(movements.map((row: any) => Number(row.billingid)).filter(Boolean))];
          const bills = billIds.length ? await db('billing').whereIn('billingid', billIds).select('billingid', 'patientid') : [];
          const patients = new Map(bills.map((row: any) => [Number(row.billingid), row.patientid]));
          // Expenses include commissions, utilities and other obligations, not only inventory receipts.
          const expenseIds = [...new Set(movements.map((row: any) => Number(row.expense_id)).filter(Boolean))];
          const expenses = expenseIds.length ? await db('expensesrecord').whereIn('id', expenseIds).select('*') : [];
          const expenseById = new Map(expenses.map((row: any) => [Number(row.id), row]));
          const patientIds = [...new Set(bills.map((row: any) => Number(row.patientid)).filter(Boolean))];
          const patientRows = patientIds.length ? await db('new_patients').whereIn('patientid', patientIds).select('patientid', 'firstname', 'middlename', 'lastname', 'fullpatientid') : [];
          const patientById = new Map(patientRows.map((row: any) => [Number(row.patientid), row]));
          const receiptRefs = movements.filter((row: any) => row.source_table === 'inv_purchase_order_receipts').map((row: any) => row.source_ref || String(row.source_pk));
          const receipts = receiptRefs.length ? await db('inv_purchase_order_receipts as r').join('inv_purchase_orders as o', 'o.id', 'r.order_id').whereIn('r.id', receiptRefs).select('r.id', 'o.supplier_id') : [];
          const supplierPaymentRefs = movements.filter((row: any) => row.source_table === 'inv_supplier_payments').map((row: any) => row.source_ref || String(row.source_pk));
          const supplierPayments = supplierPaymentRefs.length ? await db('inv_supplier_payments').whereIn('id', supplierPaymentRefs).select('id', 'supplier_id') : [];
          const supplierBySource = new Map([...receipts.map((row: any) => [`inv_purchase_order_receipts:${row.id}`, row.supplier_id]), ...supplierPayments.map((row: any) => [`inv_supplier_payments:${row.id}`, row.supplier_id])]);
          const events: ControlEvent[] = [];
          for (const movement of movements) {
               const ref = movement.source_ref || String(movement.source_pk);
               const meta: any = sources.get(`${movement.source_table}:${ref}`);
               const expense: any = expenseById.get(Number(movement.expense_id));
               const partyId = movement.party_ref ?? (ledger === 'AR' ? patients.get(Number(movement.billingid)) ?? meta?.party_id ?? null : supplierBySource.get(`${movement.source_table}:${ref}`) ?? meta?.party_id ?? expense?.merchantid ?? expense?.merchant ?? null);
               const partyType = movement.party_type || (ledger === 'AR' ? 'patient' : supplierBySource.has(`${movement.source_table}:${ref}`) ? 'supplier' : meta?.party_type || (expense ? 'merchant' : 'unassigned'));
               const patient: any = patientById.get(Number(partyId));
               const partyName = movement.party_name || (ledger === 'AR' ? [patient?.firstname, patient?.middlename, patient?.lastname].filter(Boolean).join(' ') : meta?.party_name || null);
               const reference = movement.document_ref || (movement.billingid ? `BILL-${movement.billingid}` : movement.expense_id ? `EXP-${movement.expense_id}` : meta?.document_ref || `${movement.source_table}:${ref}`);
               events.push({ id: movement.id, reference, partyId, partyType, partyName, patientIdentifier: patient?.fullpatientid || null,
                    documentDate: new Date(movement.occurred_at).toISOString().slice(0,10),
                    amount: minorUnits(movement.amount) * (movement.direction === (ledger === 'AR' ? 'debit' : 'credit') ? 1 : -1),
                    source_table: movement.source_table, source_ref: ref, branchId: Number(movement.branchid) });
          }
          return events;
     }

     private async pharmacyPayableAttribution(movements: ControlEvent[], cutoff: string, branchId?: number): Promise<ControlEvent[]> {
          if (!movements.some(row => row.partyType === 'pharmacy_supplier' && row.source_table === 'pharmacy_journals')) return movements;
          const db = await this.connection();
          const tables = await Promise.all(['pharmacy_accounting_supplier_sources', 'pharmacy_accounting_supplier_uses'].map(table => db.schema.hasTable(table)));
          if (tables.every(exists => !exists)) return movements;
          if (!tables.every(Boolean) || !await db.schema.hasTable('pharmacy_accounting_bills')) {
               throw new AccountingError('Pharmacy supplier allocation schema is incomplete', 'PHARMACY_ALLOCATION_SCHEMA_INCOMPLETE', 409);
          }
          const uses: PharmacySupplierUse[] = await db('pharmacy_accounting_supplier_uses as u')
               .join('pharmacy_accounting_supplier_sources as s', 's.id', 'u.source_id')
               .join('pharmacy_accounting_bills as b', 'b.id', 'u.bill_id')
               .where('u.financial_date', '<=', cutoff)
               .modify((query: any) => { if (branchId) query.where('u.branchid', branchId); })
               .select('u.source_id', 'u.bill_id', 'u.branchid', 'u.amount', 's.journal_id', 's.supplier_id',
                    's.branchid as source_branch', 's.amount as source_amount', 'b.branchid as bill_branch',
                    'b.supplier_id as bill_supplier', 'b.source_ref as bill_ref', 'b.document_date as bill_date');
          const projected = movements.map(row => ({ ...row }));
          const sources = new Map<string, ControlEvent[]>();
          for (const row of projected.filter(row => row.partyType === 'pharmacy_supplier' && row.source_table === 'pharmacy_journals')) {
               const key = `${row.branchId}:${row.source_ref}:${row.partyId}`;
               sources.set(key, [...(sources.get(key) || []), row]);
          }
          const groups = new Map<string, { source: ControlEvent; reference: string; date: string; amount: number }>();
          for (const use of uses) {
               const matches = sources.get(`${use.source_branch}:${use.journal_id}:${use.supplier_id}`);
               if (!matches) continue; // Independently posted local sources are not consolidated GL evidence.
               if (matches.length !== 1 || Number(use.branchid) !== Number(use.source_branch) ||
                    Number(use.branchid) !== Number(use.bill_branch) || use.supplier_id !== use.bill_supplier ||
                    matches[0].amount !== -minorUnits(use.source_amount) || !use.bill_ref ||
                    new Date(use.bill_date).toISOString().slice(0, 10) > cutoff) {
                    throw new AccountingError('Supplier allocation does not match shared payable evidence', 'PHARMACY_ALLOCATION_INCONSISTENT', 409);
               }
               const key = `${use.source_id}:${use.bill_id}`, previous = groups.get(key);
               groups.set(key, { source: matches[0], reference: use.bill_ref, date: new Date(use.bill_date).toISOString().slice(0, 10), amount: (previous?.amount || 0) + minorUnits(use.amount) });
          }
          const allocated = new Map<ControlEvent, number>();
          for (const group of groups.values()) {
               if (group.amount < 0) throw new AccountingError('Supplier release exceeds its reviewed allocation', 'PHARMACY_ALLOCATION_INCONSISTENT', 409);
               if (!group.amount) continue;
               allocated.set(group.source, (allocated.get(group.source) || 0) + group.amount);
               projected.push({ ...group.source, reference: group.reference, documentDate: group.date, amount: -group.amount });
          }
          for (const [source, applied] of allocated) {
               if (applied > -source.amount) throw new AccountingError('Supplier allocations exceed the posted source', 'PHARMACY_ALLOCATION_INCONSISTENT', 409);
               source.amount += applied;
          }
          return projected.filter(row => row.amount !== 0);
     }

     /** Posted movements are authoritative, so historical aging always ties to its GL control. */
     private async controlAccountAging(ledger: 'AR' | 'AP', asOf?: string, branchId?: number) {
          if (!this.trx) { const db = await this.connection(); return db.transaction((trx: any) => new AccountingReportService(this.tenantId, trx).controlAccountAging(ledger, asOf, branchId), { isolationLevel: 'repeatable read' }); }
          const cutoff = asOf || new Date().toISOString().slice(0, 10);
          const movements = await this.controlEvents(ledger, cutoff, branchId);
          const attributed = ledger === 'AP' ? await this.pharmacyPayableAttribution(movements, cutoff, branchId) : movements;
          const documents = new Map<string, any>();
          for (const movement of attributed) {
               const { reference, partyId, partyType, partyName } = movement;
               const key = `${partyType}:${partyId ?? 'unassigned'}:${reference}`;
               const previous = documents.get(key);
               const amount = movement.amount;
               documents.set(key, { key: `${partyType}:${partyId ?? reference}`, reference, partyId, amount: (previous?.amount || 0) + amount, date: previous?.date || movement.documentDate, partyType, partyName, patientIdentifier: movement.patientIdentifier });
          }
          const groups = new Map<string, Array<any>>();
          for (const doc of documents.values()) { if (!groups.has(doc.key)) groups.set(doc.key, []); groups.get(doc.key)!.push(doc); }
          const items: Array<any> = [];
          for (const docs of groups.values()) {
               if (docs[0].partyType === 'pharmacy_supplier') {
                    for (const doc of docs) {
                         if (doc.amount) items.push({ ...doc, reference: doc.amount < 0 ? `Unapplied credit: ${doc.reference}` : doc.reference,
                              amount: doc.amount / 100, age: doc.amount < 0 ? 0 : daysBetween(doc.date, cutoff) });
                    }
                    continue;
               }
               const charges = docs.filter(doc => doc.amount > 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
               let credit = -docs.filter(doc => doc.amount < 0).reduce((sum, doc) => sum + doc.amount, 0);
               for (const doc of charges) {
                    const applied = Math.min(credit, doc.amount); credit -= applied;
                    if (doc.amount > applied) items.push({ ...doc, amount: (doc.amount - applied) / 100, age: daysBetween(doc.date, cutoff) });
               }
               if (credit) items.push({ ...docs[0], reference: `Unapplied credit: ${docs[0].key}`, amount: -credit / 100, age: 0 });
          }
          const result = bucketise(items);
          const rows = result.rows.map((row, index) => ({ ...row, partyType: items[index].partyType, partyName: items[index].partyName || null, patientIdentifier: items[index].patientIdentifier || null, documentDate: new Date(items[index].date).toISOString().slice(0,10), ageDays: items[index].age }));
          const generalLedger = movements.reduce((sum: number, row: any) => sum + row.amount, 0) / 100;
          return { ...result, rows, basis: 'accrual', reconciliation: { generalLedger, difference: (minorUnits(result.totals.total) - minorUnits(generalLedger)) / 100 } };
     }

     async controlStatement(ledger: 'AR' | 'AP', partyType: string, partyId: string | number, from?: string, to?: string, options: any = {}) {
          if (!this.trx) { const db = await this.connection(); return db.transaction((trx: any) => new AccountingReportService(this.tenantId, trx).controlStatement(ledger, partyType, partyId, from, to, options), { isolationLevel: 'repeatable read' }); }
          const rows = (await this.controlEvents(ledger, to)).filter(row => row.partyType === partyType && String(row.partyId) === String(partyId));
          let running = rows.filter(row => from && row.documentDate < from).reduce((sum, row) => sum + row.amount, 0);
          const openingBalance = running / 100;
          const entries = rows.filter(row => !from || row.documentDate >= from).map(row => {
               running += row.amount;
               return { id: row.id, ledger, party_type: row.partyType, party_id: row.partyId, party_name: row.partyName, document_date: row.documentDate, document_ref: row.reference,
                    document_type: row.amount >= 0 ? 'charge' : 'settlement', source_table: row.source_table, source_ref: row.source_ref, amount: row.amount / 100, runningBalance: running / 100 };
          });
          const paging = parsePaging(options, 50);
          return { entries: entries.slice(paging.offset, paging.offset + paging.count), total: entries.length, page: paging.page, count: paging.count, openingBalance, closingBalance: running / 100, basis: 'accrual' };
     }

     async aging(ledger: 'AR' | 'AP', asOf?: string, options: any = {}) {
          const report = await this.controlAccountAging(ledger, asOf);
          const search = String(options.search || '').trim().toLocaleLowerCase();
          const allowedBuckets = ['current','days30','days60','days90','over90'];
          const rows = report.rows.filter(row => (!options.from || row.documentDate >= options.from) && (!options.to || row.documentDate <= options.to) &&
               (!options.patientId || String(row.partyId) === String(options.patientId)) && (!allowedBuckets.includes(options.ageBucket) || row[options.ageBucket] !== 0) &&
               (!search || [row.partyName, row.patientIdentifier, row.partyId, row.reference].some(value => String(value || '').toLocaleLowerCase().includes(search))));
          const totals = Object.fromEntries(['current','days30','days60','days90','over90','total'].map(key => [key, sumMinor(rows.map(row => row[key])) / 100]));
          const paging = parsePaging(options, 50), sort = parseSort(options, ['partyName','partyId','patientIdentifier','reference','documentDate','ageDays','current','days30','days60','days90','over90','total'], { column:'documentDate', direction:'desc' });
          const page = paginate(rows, paging, sort);
          return { rows: page.data, total: page.total, page: page.page, count: page.count, totals, basis: report.basis, reconciliation: report.reconciliation };
     }

     async cashFlow(from: string, to: string, method: 'direct' | 'indirect' = 'direct'): Promise<CashFlowStatement> {
          if (!this.trx) { const db = await this.connection(); return db.transaction((trx: any) => new AccountingReportService(this.tenantId, trx).cashFlow(from, to, method), { isolationLevel: 'repeatable read' }); }
          const db = await this.connection();
          const cashAccounts = await this.cashAccountCodes();
          const cashLines = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .whereIn('a.account_code', cashAccounts).whereNot('e.status', 'voided')
               .whereRaw('DATE(e.occurred_at) >= ?', [from]).whereRaw('DATE(e.occurred_at) <= ?', [to])
               .select('e.id as entry_id', 'l.direction', 'l.amount');
          const netByEntry = new Map<number, number>();
          for (const line of cashLines) netByEntry.set(Number(line.entry_id), (netByEntry.get(Number(line.entry_id)) || 0) + minorUnits(line.amount) * (line.direction === 'debit' ? 1 : -1));
          const entryIds = [...netByEntry.keys()];
          const grossByEntry = new Map<number, { inflow: number; outflow: number }>();
          for (const line of cashLines) {
               const id = Number(line.entry_id), gross = grossByEntry.get(id) || { inflow: 0, outflow: 0 };
               gross[line.direction === 'debit' ? 'inflow' : 'outflow'] += minorUnits(line.amount);
               grossByEntry.set(id, gross);
          }
          const operatingByEntry = new Map<number,number>();
          const buckets = new Map<string, CashFlowLine>();
          const classificationIssues: Array<{ journalEntryId: number; amount: number }> = [];
          if (entryIds.length) {
               const counterparts = await db('acc_journal_lines as l').join('acc_accounts as a', 'l.account_id', 'a.id')
                    .whereIn('l.journal_entry_id', entryIds).whereNotIn('a.account_code', cashAccounts)
                    .select('l.journal_entry_id', 'l.amount', 'l.direction', 'a.account_code', 'a.name', 'a.type');
               const classifications = await db('acc_cash_flow_classifications').whereIn('journal_entry_id', entryIds);
               const reviewed = new Map(classifications.map((row: any) => [Number(row.journal_entry_id), row]));
               const add = (entryId:number, category: CashFlowLine['category'], code: string, name: string, amount: number, inflow = Math.max(0, amount), outflow = Math.max(0, -amount)) => {
                    if(category==='operating') operatingByEntry.set(entryId,(operatingByEntry.get(entryId)||0)+amount);
                    const key = `${category}:${code}`, previous = buckets.get(key);
                    buckets.set(key, { category, accountCode: code, accountName: name, amount: (previous?.amount || 0) + amount,
                         inflow: (previous?.inflow || 0) + inflow, outflow: (previous?.outflow || 0) + outflow });
               };
               for (const id of entryIds) {
                    const net = netByEntry.get(id)!;
                    const parts = counterparts.filter((line: any) => Number(line.journal_entry_id) === id);
                    const counterpartNet = parts.reduce((sum: number, line: any) => sum + minorUnits(line.amount) * (line.direction === 'credit' ? 1 : -1), 0);
                    if (counterpartNet !== net) {
                         add(id, 'unclassified', `JOURNAL-${id}`, 'Unbalanced source journal: review required', counterpartNet);
                         classificationIssues.push({ journalEntryId: id, amount: net / 100 });
                         continue;
                    }
                    if (!parts.length && net === 0) continue; // Proven cash-only transfer, not external activity.
                    const gross = grossByEntry.get(id)!;
                    const saved = readCashFlowReview(reviewed.get(id), net, { inflowMinor: gross.inflow, outflowMinor: gross.outflow });
                    if (saved) {
                         for (const row of saved) add(id, row.category, `JOURNAL-${id}`, 'Reviewed cash flow classification',
                              minorUnits(row.inflow) - minorUnits(row.outflow), minorUnits(row.inflow), minorUnits(row.outflow));
                         continue;
                    }
                    const categories = new Set(parts.map((line: any) => classifyCashFlow(line.account_code, line.type)));
                    // A compound cash/non-cash journal does not prove the gross cash split.
                    // Keep its cash visible and require an explicit reviewed allocation.
                    if (categories.size !== 1 || (gross.inflow > 0 && gross.outflow > 0) || categories.has('unclassified')) {
                         add(id, 'unclassified', `JOURNAL-${id}`, 'Compound journal: classification required', net, gross.inflow, gross.outflow);
                         classificationIssues.push({ journalEntryId: id, amount: net / 100 });
                    } else {
                         // Opposing noncash lines do not prove gross receipts/payments.
                         if (parts.some((line: any) => (line.direction === 'credit' ? 1 : -1) !== Math.sign(net))) {
                              add(id, [...categories][0] as CashFlowLine['category'], `JOURNAL-${id}`, 'Net cash movement', net);
                         } else for (const line of parts) add(id, classifyCashFlow(line.account_code, line.type), line.account_code, line.name, minorUnits(line.amount) * (line.direction === 'credit' ? 1 : -1));
                    }
               }
          }
          const lines = [...buckets.values()].filter(line => line.amount || line.inflow || line.outflow).map(line => ({ ...line, amount: line.amount / 100, inflow: (line.inflow || 0) / 100, outflow: (line.outflow || 0) / 100 }));
          const sumBy = (category: CashFlowLine['category']) => sumMinor(lines.filter(line => line.category === category).map(line => line.amount)) / 100;
          const openingCash = await this.cashBalanceAsOf(previousDay(from), cashAccounts), closingCash = await this.cashBalanceAsOf(to, cashAccounts);
          const netMovement = (minorUnits(closingCash) - minorUnits(openingCash)) / 100;
          const allocated = sumMinor(lines.map(line => line.amount));
          const indirect = method === 'indirect' ? await this.indirectOperating(from,to,cashAccounts,operatingByEntry) : undefined;
          return { method, indirect, lines, classificationIssues, totals: { operating: sumBy('operating'), investing: sumBy('investing'), financing: sumBy('financing'), unclassified: sumBy('unclassified'), netMovement, openingCash, closingCash },
               reconciliation: { difference: (minorUnits(netMovement) - allocated) / 100, balanced: minorUnits(netMovement) === allocated } };
     }

     private async indirectOperating(from:string,to:string,cashAccounts:string[],operatingByEntry:Map<number,number>) {
          const db=await this.connection();
          const rows=await db('acc_journal_lines as l').join('acc_journal_entries as e','e.id','l.journal_entry_id').join('acc_accounts as a','a.id','l.account_id').whereNot('e.status','voided').where((b:any)=>b.whereNull('e.source_table').orWhereNot('e.source_table','acc_year_close')).whereRaw('DATE(e.occurred_at) >= ?',[from]).whereRaw('DATE(e.occurred_at) <= ?',[to]).select('e.id','e.description','e.occurred_at','a.account_code','a.name','a.type','l.direction','l.amount');
          let netIncome=0;const working=new Map<string,any>(),adjustments=new Map<string,any>(),entries=new Map<number,any>();
          const add=(map:Map<string,any>,r:any,amount:number)=>{const old=map.get(r.account_code);map.set(r.account_code,{accountCode:r.account_code,accountName:r.name,amount:(old?.amount||0)+amount});};
          for(const r of rows){const movement=minorUnits(r.amount)*(r.direction==='debit'?1:-1);let ni=0,wc=0,adj=0;
               if(r.type==='revenue'||r.type==='expense') ni=-movement;
               else if(r.account_code==='acc-1007') {adj=-movement;add(adjustments,r,adj);}
               else if(!cashAccounts.includes(r.account_code)&&classifyCashFlow(r.account_code,r.type)==='operating'&&(r.type==='asset'||r.type==='liability')) {wc=-movement;add(working,r,wc);}
               netIncome+=ni;const old=entries.get(Number(r.id))||{journalEntryId:Number(r.id),description:r.description,date:r.occurred_at,derived:0};old.derived+=ni+wc+adj;entries.set(Number(r.id),old);
          }
          const convert=(m:Map<string,any>)=>[...m.values()].filter(r=>r.amount!==0).map(r=>({...r,amount:r.amount/100}));
          const reclassifications=[...entries.values()].map(e=>({journalEntryId:e.journalEntryId,description:e.description,date:e.date,amount:((operatingByEntry.get(e.journalEntryId)||0)-e.derived)/100})).filter(e=>e.amount!==0);
          const adjustmentRows=convert(adjustments),workingCapital=convert(working);
          return {netIncome:netIncome/100,adjustments:adjustmentRows,adjustmentsTotal:sumMinor(adjustmentRows.map(r=>r.amount))/100,workingCapital,workingCapitalTotal:sumMinor(workingCapital.map(r=>r.amount))/100,reclassifications,reclassificationsTotal:sumMinor(reclassifications.map(r=>r.amount))/100};
     }

     async saveCashFlowClassification(journalEntryId: number, amounts: CashFlowReviewInput, employeeId: number) {
          const db = await this.connection();
          return db.transaction(async (trx: any) => {
               const entry = await trx('acc_journal_entries').where({ id: journalEntryId }).first();
               if (!entry || entry.status === 'voided') throw new AccountingError('Posted journal not found', 'JOURNAL_ENTRY_NOT_FOUND', 404);
               await new AccountingPeriodService(this.tenantId).assertPostingAllowed(entry.occurred_at, trx);
               await new FinancialFinalizationGuard(this.tenantId, trx).assertRecordMutable('acc_journal_entries', journalEntryId);
               await trx('acc_journal_entries').where({ id: journalEntryId }).forUpdate().first();
               const report = new AccountingReportService(this.tenantId, trx), codes = await report.cashAccountCodes();
               const cash = await trx('acc_journal_lines as l').join('acc_accounts as a','a.id','l.account_id').where('l.journal_entry_id',journalEntryId).whereIn('a.account_code',codes).select('l.amount','l.direction','l.branchid');
               for (const branchId of [...new Set<number>(cash.map((line: any) => Number(line.branchid)).filter(Boolean))]) await new FinancialFinalizationGuard(this.tenantId, trx).assertDateOpen(branchId, entry.occurred_at);
               const net = cash.reduce((sum: number, line: any) => sum + minorUnits(line.amount) * (line.direction === 'debit' ? 1 : -1), 0);
               if (!cash.length) throw new AccountingError('The journal has no cash movements', 'INVALID_CASH_FLOW_CLASSIFICATION', 400);
               const allLines = await trx('acc_journal_lines as l').join('acc_accounts as a', 'a.id', 'l.account_id')
                    .where('l.journal_entry_id', journalEntryId).select('a.account_code', 'l.amount', 'l.direction');
               const journalNet = allLines.reduce((sum: number, line: any) => sum + minorUnits(line.amount) * (line.direction === 'debit' ? 1 : -1), 0);
               if (journalNet || allLines.every((line: any) => codes.includes(line.account_code))) {
                    throw new AccountingError('Only a balanced journal with external counterpart evidence can be classified', 'INVALID_CASH_FLOW_CLASSIFICATION', 400);
               }
               const review = cashFlowReview(amounts, net, {
                    inflowMinor: sumMinor(cash.filter((line: any) => line.direction === 'debit').map((line: any) => line.amount)),
                    outflowMinor: sumMinor(cash.filter((line: any) => line.direction === 'credit').map((line: any) => line.amount)),
               });
               const before = await trx('acc_cash_flow_classifications').where({ journal_entry_id: journalEntryId }).first();
               const after = { journal_entry_id: journalEntryId, operating: review.operating, investing: review.investing, financing: review.financing,
                    ...(amounts.allocations !== undefined ? { gross_allocations: JSON.stringify(review.allocations) } : before?.gross_allocations ? { gross_allocations: null } : {}),
                    updated_by: employeeId, updated_at: new Date() };
               await trx('acc_cash_flow_classifications').insert(after).onConflict('journal_entry_id').merge();
               await trx('acc_control_audit').insert({ action:'cash_flow_classification', entity_id:journalEntryId, employee_id:employeeId, before_state:JSON.stringify(before || {}), after_state:JSON.stringify(after), created_at:new Date() });
               return after;
          });
     }

     async periodBreakdown(
          type: 'revenue' | 'expense',
          from: string,
          to: string,
          branchId?: number
     ): Promise<{ rows: PeriodBreakdownRow[]; periods: string[]; totals: Record<string, number> }> {
          const db = await this.connection();

          const query = db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .where('a.type', type)
               .where((b:any)=>b.whereNull('e.source_table').orWhereNot('e.source_table','acc_year_close'))
               .andWhere('e.status', '!=', 'voided')
               .andWhereRaw('DATE(e.occurred_at) >= ?', [from])
               .andWhereRaw('DATE(e.occurred_at) <= ?', [to])
               .groupBy('a.account_code', 'a.name', 'a.normal_balance', 'period')
               .select(
                    'a.account_code',
                    'a.name',
                    'a.normal_balance',
                    db.raw("DATE_FORMAT(e.occurred_at, '%Y-%m') AS period"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits")
               );

          if (branchId) query.andWhere('l.branchid', branchId);

          const raw = await query;
          const periods: string[] = [...new Set<string>(raw.map((row: any) => String(row.period)))].sort();
          const byAccount = new Map<string, PeriodBreakdownRow>();

          for (const row of raw) {
               const balance =
                    type === 'expense'
                         ? Number(row.debits) - Number(row.credits)
                         : Number(row.credits) - Number(row.debits);

               if (!byAccount.has(row.account_code)) {
                    byAccount.set(row.account_code, {
                         accountCode: row.account_code,
                         accountName: row.name,
                         periods: {},
                         total: 0,
                    });
               }

               const entry = byAccount.get(row.account_code)!;
               entry.periods[row.period] = round2((entry.periods[row.period] || 0) + balance);
               entry.total = round2(entry.total + balance);
          }

          const rows = [...byAccount.values()].sort((left, right) => right.total - left.total);
          const totals: Record<string, number> = { total: round2(rows.reduce((sum, row) => sum + row.total, 0)) };
          for (const period of periods) {
               totals[period] = round2(rows.reduce((sum, row) => sum + (row.periods[period] || 0), 0));
          }

          return { rows, periods, totals };
     }

     async branchPerformance(from: string, to: string): Promise<BranchPerformanceRow[]> {
          const db = await this.connection();

          const raw = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .whereIn('a.type', ['revenue', 'expense'])
               .where((b:any)=>b.whereNull('e.source_table').orWhereNot('e.source_table','acc_year_close'))
               .andWhere('e.status', '!=', 'voided')
               .andWhereRaw('DATE(e.occurred_at) >= ?', [from])
               .andWhereRaw('DATE(e.occurred_at) <= ?', [to])
               .groupBy('l.branchid', 'a.account_code', 'a.type', 'a.normal_balance')
               .select(
                    'l.branchid',
                    'a.account_code',
                    'a.type',
                    'a.normal_balance',
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits")
               );

          const byBranch = new Map<string, BranchPerformanceRow>();

          for (const row of raw) {
               const key = row.branchid === null || row.branchid === undefined ? 'none' : String(row.branchid);
               if (!byBranch.has(key)) {
                    byBranch.set(key, {
                         branchid: row.branchid ? Number(row.branchid) : null,
                         revenue: 0,
                         costOfSales: 0,
                         grossProfit: 0,
                         operatingExpenses: 0,
                         netProfit: 0,
                    });
               }

               const entry = byBranch.get(key)!;
               const balance =
                    row.type === 'expense'
                         ? Number(row.debits) - Number(row.credits)
                         : Number(row.credits) - Number(row.debits);

               if (row.type === 'revenue') entry.revenue = round2(entry.revenue + balance);
               else if (COST_OF_SALES_CODES.includes(row.account_code)) entry.costOfSales = round2(entry.costOfSales + balance);
               else entry.operatingExpenses = round2(entry.operatingExpenses + balance);
          }

          return [...byBranch.values()]
               .map((row) => ({
                    ...row,
                    grossProfit: round2(row.revenue - row.costOfSales),
                    netProfit: round2(row.revenue - row.costOfSales - row.operatingExpenses),
               }))
               .sort((left, right) => right.netProfit - left.netProfit);
     }

     async inventoryValuation(asOf?: string, options?: { page?: number; count?: number; sortby?: string }): Promise<InventoryValuation> {
          const db = await this.connection();
          if (!this.trx) return db.transaction((trx: any) => new AccountingReportService(this.tenantId, trx).inventoryValuation(asOf, options), { isolationLevel: 'repeatable read' });
          return inventoryValuation(db, asOf, options);
     }

     private async cashAccountCodes(): Promise<string[]> {
          const db = await this.connection();
          const banks = await db('acc_bank_accounts').select('gl_account_code');
          return [...new Set<string>([...CASH_ACCOUNTS, ...banks.map((bank: any) => String(bank.gl_account_code))])];
     }

     private async cashBalanceAsOf(asOf: string, codes?: string[]): Promise<number> {
          const db = await this.connection();

          const row = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .whereIn('a.account_code', codes || await this.cashAccountCodes())
               .andWhere('e.status', '!=', 'voided')
               .andWhereRaw('DATE(e.occurred_at) <= ?', [asOf])
               .select(
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits")
               )
               .first();

          return round2(Number((row as any)?.debits || 0) - Number((row as any)?.credits || 0));
     }

     private async accountBalances(filters: {
          excludeClosing?: boolean;
          from?: string;
          to?: string;
          branchId?: number;
     }): Promise<TrialBalanceRow[]> {
          const db = await this.connection();

          const query = db('acc_accounts as a')
               .leftJoin('acc_journal_lines as l', 'l.account_id', 'a.id')
               .leftJoin('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .groupBy('a.id', 'a.account_code', 'a.name', 'a.type', 'a.normal_balance')
               .orderBy('a.account_code', 'asc')
               .select(
                    'a.account_code',
                    'a.name',
                    'a.type',
                    'a.normal_balance',
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits")
               );

          query.where((builder: any) => {
               builder.whereNull('e.id').orWhere('e.status', '!=', 'voided');
          });

          if (filters.excludeClosing) query.where((b:any)=>b.whereNull('e.source_table').orWhereNot('e.source_table','acc_year_close'));
          if (filters.from) query.andWhere((b: any) => b.whereNull('e.id').orWhereRaw('DATE(e.occurred_at) >= ?', [filters.from]));
          if (filters.to) query.andWhere((b: any) => b.whereNull('e.id').orWhereRaw('DATE(e.occurred_at) <= ?', [filters.to]));
          if (filters.branchId) query.andWhere((b: any) => b.whereNull('e.id').orWhere('l.branchid', filters.branchId));

          const rows = await query;

          return rows.map((row: any) => {
               const debits = Number(row.debits || 0);
               const credits = Number(row.credits || 0);
               const balance = row.normal_balance === 'debit' ? debits - credits : credits - debits;
               return {
                    account_code: row.account_code,
                    name: row.name,
                    type: row.type,
                    normal_balance: row.normal_balance,
                    debits: round2(debits),
                    credits: round2(credits),
                    balance: round2(balance),
               };
          });
     }
}

function bucketise(
     items: Array<{ reference: string; partyId: number | null; amount: number; age: number }>
): { rows: AgingBucket[]; totals: AgingBucket } {
     const rows: AgingBucket[] = items.map((item) => {
          const bucket: AgingBucket = {
               reference: item.reference,
               partyId: item.partyId,
               current: 0,
               days30: 0,
               days60: 0,
               days90: 0,
               over90: 0,
               total: round2(item.amount),
          };

          if (item.age <= 0) bucket.current = bucket.total;
          else if (item.age <= 30) bucket.days30 = bucket.total;
          else if (item.age <= 60) bucket.days60 = bucket.total;
          else if (item.age <= 90) bucket.days90 = bucket.total;
          else bucket.over90 = bucket.total;

          return bucket;
     });

     const totals: AgingBucket = {
          reference: 'TOTAL',
          partyId: null,
          current: round2(rows.reduce((sum, row) => sum + row.current, 0)),
          days30: round2(rows.reduce((sum, row) => sum + row.days30, 0)),
          days60: round2(rows.reduce((sum, row) => sum + row.days60, 0)),
          days90: round2(rows.reduce((sum, row) => sum + row.days90, 0)),
          over90: round2(rows.reduce((sum, row) => sum + row.over90, 0)),
          total: round2(rows.reduce((sum, row) => sum + row.total, 0)),
     };

     return { rows, totals };
}

function classifyCashFlow(accountCode: string, accountType: string): CashFlowLine['category'] {
     if (INVESTING_CODES.includes(accountCode)) return 'investing';
     if (FINANCING_CODES.includes(accountCode) || accountType === 'equity') return 'financing';
     return 'operating';
}

function previousDay(date: string): string {
     const value = new Date(date);
     value.setDate(value.getDate() - 1);
     return value.toISOString().split('T')[0];
}

function daysBetween(start: Date | string, end: Date | string): number {
     const startMs = new Date(start).getTime();
     const endMs = new Date(end).getTime();
     if (!isFinite(startMs) || !isFinite(endMs)) return 0;
     return Math.floor((endMs - startMs) / 86_400_000);
}

function sumBalances(rows: TrialBalanceRow[]): number {
     return round2(rows.reduce((total, row) => total + row.balance, 0));
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}

function performanceTotals(statement: IncomeStatement) {
     const expenses = round2(statement.totals.costOfSales + statement.totals.operatingExpenses);
     return {
          revenue: round2(statement.totals.revenue),
          expenses,
          profit: round2(statement.totals.revenue - expenses),
     };
}

/** Contra accounts retain their sign in financial statements, regardless of normal balance. */
function presentationBalance(row: TrialBalanceRow): TrialBalanceRow {
     return { ...row, balance: (minorUnits(row.debits) - minorUnits(row.credits)) * (['asset', 'expense'].includes(row.type) ? 1 : -1) / 100 };
}
