import KnexConnection from '../../database/KnexConnections';
import { ensureAccountingSchema } from '../init/accountingSchemaInit';
import {
     AgingBucket,
     BalanceSheet,
     BranchPerformanceRow,
     CashFlowLine,
     CashFlowStatement,
     IAccountingReportService,
     IncomeStatement,
     InventoryValuation,
     InventoryValuationRow,
     LedgerLine,
     PeriodBreakdownRow,
     TrialBalanceRow,
} from '../interfaces/IAccountingReportService';

const COST_OF_SALES_CODES = ['acc-5000'];
const CASH_ACCOUNTS = ['acc-1000', 'acc-1001'];
const INVENTORY_ACCOUNT = 'acc-1003';
const INVESTING_CODES = ['acc-1006', 'acc-1007'];
const FINANCING_CODES = ['acc-2001', 'acc-3000', 'acc-3001'];

export class AccountingReportService implements IAccountingReportService {
     constructor(private tenantId: number) { }

     private async connection() {
          await ensureAccountingSchema(this.tenantId);
          return KnexConnection(this.tenantId);
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

     async generalLedger(filters: {
          from?: string;
          to?: string;
          accountCode?: string;
          sourceModule?: string;
          branchId?: number;
          page?: number;
          count?: number;
     }): Promise<{ data: LedgerLine[]; total: number; page: number; count: number }> {
          const db = await this.connection();
          const page = Math.max(1, Number(filters.page) || 1);
          const count = Math.min(200, Math.max(1, Number(filters.count) || 50));

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
               .orderBy([{ column: 'e.occurred_at', order: 'desc' }, { column: 'e.id', order: 'desc' }])
               .limit(count)
               .offset((page - 1) * count);

          return { data, total: Number(totalRow?.total || 0), page, count };
     }

     async incomeStatement(from: string, to: string, branchId?: number): Promise<IncomeStatement> {
          const rows = await this.accountBalances({ from, to, branchId });

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
          const rows = await this.accountBalances({ to: asOf, branchId });

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

     async receivableAging(asOf?: string): Promise<{ rows: AgingBucket[]; totals: AgingBucket }> {
          const db = await this.connection();
          const cutoff = asOf || new Date().toISOString().split('T')[0];

          const bills = await db('billing')
               .select('billingid', 'patientid', 'outstanding', 'billedon')
               .where('outstanding', '>', 0)
               .whereNotIn('status', ['voided', 'written-off'])
               .whereRaw('DATE(billedon) <= ?', [cutoff]);

          return bucketise(
               bills.map((bill: any) => ({
                    reference: `BILL-${bill.billingid}`,
                    partyId: bill.patientid ? Number(bill.patientid) : null,
                    amount: Number(bill.outstanding || 0),
                    age: daysBetween(bill.billedon, cutoff),
               }))
          );
     }

     async payableAging(asOf?: string): Promise<{ rows: AgingBucket[]; totals: AgingBucket }> {
          const db = await this.connection();
          const cutoff = asOf || new Date().toISOString().split('T')[0];

          const received = await db('inv_purchase_order_receipts as r')
               .join('inv_purchase_orders as o', 'r.order_id', 'o.id')
               .whereRaw('DATE(r.received_date) <= ?', [cutoff])
               .andWhere('o.status', '!=', 'cancelled')
               .groupBy('o.id', 'o.supplier_id', 'o.order_number')
               .select(
                    'o.id as order_id',
                    'o.order_number',
                    'o.supplier_id',
                    db.raw('MIN(r.received_date) AS first_received'),
                    db.raw('COALESCE(SUM(r.quantity_received * r.unit_price), 0) AS received_value')
               );

          const rows: Array<{ reference: string; partyId: number | null; amount: number; age: number }> = [];

          for (const order of received) {
               const paidRow = await db('inv_supplier_payments')
                    .where('purchase_order_id', order.order_id)
                    .andWhere('payment_status', 'completed')
                    .sum('payment_amount as paid')
                    .first();

               const balance = round2(Number(order.received_value || 0) - Number(paidRow?.paid || 0));
               if (balance <= 0) continue;

               rows.push({
                    reference: order.order_number || String(order.order_id),
                    partyId: null,
                    amount: balance,
                    age: daysBetween(order.first_received, cutoff),
               });
          }

          return bucketise(rows);
     }

     async cashFlow(from: string, to: string): Promise<CashFlowStatement> {
          const db = await this.connection();

          const cashLines = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .whereIn('a.account_code', CASH_ACCOUNTS)
               .andWhere('e.status', '!=', 'voided')
               .andWhereRaw('DATE(e.occurred_at) >= ?', [from])
               .andWhereRaw('DATE(e.occurred_at) <= ?', [to])
               .select('e.id as entry_id', 'l.direction', 'l.amount');

          const netByEntry = new Map<number, number>();
          for (const line of cashLines) {
               const signed = line.direction === 'debit' ? Number(line.amount) : -Number(line.amount);
               netByEntry.set(line.entry_id, round2((netByEntry.get(line.entry_id) || 0) + signed));
          }

          const entryIds = [...netByEntry.keys()].filter((id) => Math.abs(netByEntry.get(id) || 0) > 0.001);
          const buckets = new Map<string, CashFlowLine>();

          if (entryIds.length > 0) {
               const counterparts = await db('acc_journal_lines as l')
                    .join('acc_accounts as a', 'l.account_id', 'a.id')
                    .whereIn('l.journal_entry_id', entryIds)
                    .whereNotIn('a.account_code', CASH_ACCOUNTS)
                    .select('l.journal_entry_id', 'l.amount', 'a.account_code', 'a.name', 'a.type');

               const weightByEntry = new Map<number, number>();
               for (const line of counterparts) {
                    weightByEntry.set(
                         line.journal_entry_id,
                         round2((weightByEntry.get(line.journal_entry_id) || 0) + Number(line.amount))
                    );
               }

               for (const line of counterparts) {
                    const entryNet = netByEntry.get(line.journal_entry_id) || 0;
                    const weight = weightByEntry.get(line.journal_entry_id) || 0;
                    if (weight === 0) continue;

                    const share = round2(entryNet * (Number(line.amount) / weight));
                    const category = classifyCashFlow(line.account_code, line.type);
                    const key = `${category}:${line.account_code}`;

                    const existing = buckets.get(key);
                    if (existing) existing.amount = round2(existing.amount + share);
                    else
                         buckets.set(key, {
                              category,
                              accountCode: line.account_code,
                              accountName: line.name,
                              amount: share,
                         });
               }
          }

          const lines = [...buckets.values()].filter((line) => Math.abs(line.amount) > 0.001);
          const sumBy = (category: CashFlowLine['category']) =>
               round2(lines.filter((line) => line.category === category).reduce((total, line) => total + line.amount, 0));

          const openingCash = await this.cashBalanceAsOf(previousDay(from));
          const netMovement = round2(sumBy('operating') + sumBy('investing') + sumBy('financing'));

          return {
               lines: lines.sort((left, right) => left.category.localeCompare(right.category) || right.amount - left.amount),
               totals: {
                    operating: sumBy('operating'),
                    investing: sumBy('investing'),
                    financing: sumBy('financing'),
                    netMovement,
                    openingCash,
                    closingCash: round2(openingCash + netMovement),
               },
          };
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
          const periods = [...new Set(raw.map((row: any) => row.period as string))].sort();
          const byAccount = new Map<string, PeriodBreakdownRow>();

          for (const row of raw) {
               const balance =
                    row.normal_balance === 'debit'
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
                    row.normal_balance === 'debit'
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

     async inventoryValuation(asOf?: string): Promise<InventoryValuation> {
          const db = await this.connection();

          const items = await db('inv_inventory_items')
               .where('is_active', true)
               .andWhere('current_stock', '>', 0)
               .select('id', 'name', 'sku', 'current_stock');

          const rows: InventoryValuationRow[] = [];

          for (const item of items) {
               const costRow = await db('inv_inventory_transactions')
                    .where('item_id', item.id)
                    .andWhere('unit_cost', '>', 0)
                    .orderBy('transaction_date', 'desc')
                    .select('unit_cost')
                    .first();

               const unitCost = Number(costRow?.unit_cost || 0);
               const quantity = Number(item.current_stock || 0);

               rows.push({
                    itemId: item.id,
                    name: item.name,
                    sku: item.sku || null,
                    quantity,
                    unitCost: round2(unitCost),
                    value: round2(quantity * unitCost),
               });
          }

          const balances = await this.accountBalances({ to: asOf });
          const inventoryAccount = balances.find((row) => row.account_code === INVENTORY_ACCOUNT);
          const value = round2(rows.reduce((total, row) => total + row.value, 0));
          const generalLedger = round2(inventoryAccount?.balance || 0);

          return {
               rows: rows.sort((left, right) => right.value - left.value),
               totals: {
                    quantity: round2(rows.reduce((total, row) => total + row.quantity, 0)),
                    value,
                    generalLedger,
                    difference: round2(value - generalLedger),
               },
          };
     }

     private async cashBalanceAsOf(asOf: string): Promise<number> {
          const db = await this.connection();

          const row = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .whereIn('a.account_code', CASH_ACCOUNTS)
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
