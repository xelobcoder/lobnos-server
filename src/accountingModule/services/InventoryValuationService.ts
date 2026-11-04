import Decimal from 'decimal.js';
import { AccountingError } from '../errors/AccountingErrors';
import { InventoryValuation, InventoryValuationRow } from '../interfaces/IAccountingReportService';
import { parsePaging, parseSort, paginate } from '../utils/pagination';
import { minorUnits, sumMinor } from '../utils/money';

const unsupported = (message: string): never => { throw new AccountingError(message, 'INVENTORY_HISTORY_UNSUPPORTED', 409); };
const day = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);

/**
 * Replay only a complete zero-opening movement chain with evidenced costs. Current
 * cost/quantity is a verification anchor, never a substitute for missing history.
 */
export function historicalStock(item: any, movements: any[], cutoff: string, precision: number) {
     const evidence = (value: any): Decimal => {
          try {
               if (value == null || !['number', 'string'].includes(typeof value)) throw new Error();
               const result = new Decimal(value);
               if (!result.isFinite() || result.lt(0)) throw new Error();
               return result;
          } catch { return unsupported(`Invalid quantity/cost evidence for inventory item ${item.id}`); }
     };
     const persistedStock = evidence(item.current_stock), persistedCost = evidence(item.cost_price);
     let stock = new Decimal(0), cost = new Decimal(0), targetStock = stock, targetCost = cost;
     const ordered = [...movements].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime() || String(a.id).localeCompare(String(b.id)));
     if (!ordered.length) {
          return unsupported(`No opening quantity/cost evidence for inventory item ${item.id}`);
     }
     // Resolve equal-timestamp movements by their stock snapshots, not random UUID order.
     for (let i = 0; i < ordered.length;) {
          const time = new Date(ordered[i].transaction_date).getTime();
          if (!Number.isFinite(time)) unsupported(`Undated stock history for inventory item ${item.id}`);
          let end = i + 1;
          while (end < ordered.length && new Date(ordered[end].transaction_date).getTime() === time) end++;
          const group = ordered.slice(i, end);
          while (group.length) {
               const candidates = group.filter(row => evidence(row.previous_stock).eq(stock));
               if (candidates.length !== 1) unsupported(`Incomplete or ambiguous stock snapshot chain for inventory item ${item.id}`);
               const movement = candidates[0];
               group.splice(group.indexOf(movement), 1);
               if (movement.new_stock == null || movement.total_cost == null) unsupported(`Missing quantity/cost evidence for inventory item ${item.id}`);
               const next = evidence(movement.new_stock), amount = evidence(movement.total_cost), delta = next.minus(stock);
               if (!next.isFinite() || next.lt(0) || !amount.isFinite() || amount.lt(0)) unsupported(`Invalid stock evidence for inventory item ${item.id}`);
               if (delta.gt(0)) {
                    // Incoming total_cost is the base-unit movement value, unlike pack unit_cost.
                    cost = stock.mul(cost).plus(amount).div(next).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
               } else if (delta.lt(0)) {
                    if (!delta.abs().mul(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).eq(amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP))) {
                         unsupported(`Historical outflow cost does not match moving-average evidence for inventory item ${item.id}`);
                    }
               } else if (!amount.isZero()) unsupported(`Unsupported stock revaluation history for inventory item ${item.id}`);
               stock = next;
               if (day(movement.transaction_date) <= cutoff) { targetStock = stock; targetCost = cost; }
          }
          i = end;
     }
     if (!stock.eq(persistedStock) || !cost.eq(persistedCost.toDecimalPlaces(precision, Decimal.ROUND_HALF_UP))) {
          unsupported(`Stock history does not reconcile to the persisted quantity/cost for inventory item ${item.id}`);
     }
     return { quantity: targetStock.toNumber(), unitCost: targetCost.toNumber(), value: targetStock.mul(targetCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() };
}

export async function inventoryValuation(db: any, asOf?: string, options: any = {}): Promise<InventoryValuation> {
     const today = new Date().toISOString().slice(0, 10), cutoff = asOf || today;
     if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !Number.isFinite(Date.parse(cutoff)) || day(new Date(cutoff)) !== cutoff || cutoff > today) {
          throw new AccountingError('Use a valid inventory asOf date not later than today', 'INVALID_INVENTORY_DATE', 400);
     }
     const control = await db('acc_journal_lines as l').join('acc_journal_entries as e', 'e.id', 'l.journal_entry_id')
          .join('acc_accounts as a', 'a.id', 'l.account_id').where('a.account_code', 'acc-1003').whereNot('e.status', 'voided')
          .whereRaw('DATE(e.occurred_at) <= ?', [cutoff]).select('e.source_module', 'l.branchid', 'l.direction', 'l.amount');
     const pharmacyBranches = new Set<number>(control.filter((row: any) => row.source_module === 'pharmacy').map((row: any) => Number(row.branchid)));
     const settings = await db.schema.hasTable('pharmacy_accounting_settings') ? await db('pharmacy_accounting_settings') : [];
     for (const setting of settings) {
          if (Number(setting.enabled) && setting.effective_date && day(setting.effective_date) <= cutoff) pharmacyBranches.add(Number(setting.branchid));
     }
     const pharmacyItems: any[] = [];
     for (const branch of pharmacyBranches) {
          const setting = settings.find((row: any) => Number(row.branchid) === branch);
          if (!setting || !await db.schema.hasTable('pharmacy_inventory_items') || !await db.schema.hasTable('pharmacy_accounting_posting_links')) {
               throw new AccountingError('Consolidated pharmacy inventory evidence is unavailable', 'INVENTORY_POPULATION_INCOMPLETE', 409);
          }
          const mappings = typeof setting.mappings === 'string' ? JSON.parse(setting.mappings) : setting.mappings;
          if (mappings?.inventory !== 'acc-1003') throw new AccountingError('Consolidated inventory requires the canonical inventory control mapping', 'INVENTORY_POPULATION_INCOMPLETE', 409);
          const local = db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
               .where({ 'j.branchid': branch, 'l.account_code': 'inventory' }).where('j.financial_date', '<=', cutoff);
          const missing = await local.clone().leftJoin('pharmacy_accounting_posting_links as p', function(this: any) {
               this.on('p.journal_id', 'j.id').andOn('p.branchid', 'j.branchid');
          }).whereNull('p.journal_id').first();
          const localBalance = await local.clone().sum('l.debit as debit').sum('l.credit as credit').first();
          const sharedMinor = control.filter((row: any) => row.source_module === 'pharmacy' && Number(row.branchid) === branch)
               .reduce((sum: number, row: any) => sum + minorUnits(row.amount) * (row.direction === 'debit' ? 1 : -1), 0);
          if (missing || minorUnits(localBalance?.debit || 0) - minorUnits(localBalance?.credit || 0) !== sharedMinor) {
               throw new AccountingError('Review incomplete pharmacy inventory consolidation before comparing physical and shared balances', 'INVENTORY_POPULATION_INCOMPLETE', 409);
          }
          pharmacyItems.push(...(await db('pharmacy_inventory_items').where({ branchid: branch })).map((row: any) => ({ ...row, population: 'pharmacy' })));
     }
     const pharmacyIds = new Set(pharmacyItems.filter(item => !item.created_at || day(item.created_at) <= cutoff).map(item => String(item.id)));
     const facilityItems = (await db('inv_inventory_items')).filter((item: any) => !pharmacyIds.has(String(item.id))).map((item: any) => ({ ...item, population: 'facility' }));
     const rows: InventoryValuationRow[] = [];
     for (const item of [...facilityItems, ...pharmacyItems]) {
          if (item.created_at && day(item.created_at) > cutoff) continue;
          let value: { quantity: number; unitCost: number; value: number };
          if (cutoff < today) {
               const table = item.population === 'pharmacy' ? 'pharmacy_stock_movements' : 'inv_inventory_transactions';
               if (!await db.schema.hasTable(table)) unsupported('Historical stock movement evidence is unavailable');
               const query = db(table).where({ item_id: item.id });
               if (item.population === 'pharmacy') query.where('branchid', item.branchid);
               value = historicalStock(item, await query, cutoff, item.population === 'pharmacy' ? 6 : 2);
          } else {
               if (item.current_stock == null || item.cost_price == null) unsupported(`Persisted stock/cost is unavailable for inventory item ${item.id}`);
               const quantity = new Decimal(item.current_stock), cost = new Decimal(item.cost_price);
               if (!quantity.isFinite() || !cost.isFinite() || quantity.lt(0) || cost.lt(0)) unsupported(`Invalid persisted stock/cost for inventory item ${item.id}`);
               value = { quantity: quantity.toNumber(), unitCost: cost.toNumber(), value: quantity.mul(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() };
          }
          if (value.quantity || value.value) rows.push({ itemId: item.id, name: item.name, sku: item.sku || null, ...value, population: item.population, branchid: item.branchid ?? null });
     }
     const generalLedger = control.reduce((sum: number, row: any) => sum + minorUnits(row.amount) * (row.direction === 'debit' ? 1 : -1), 0) / 100;
     const value = sumMinor(rows.map(row => row.value)) / 100;
     const page = paginate(rows, parsePaging(options, 50), parseSort(options, ['name', 'sku', 'quantity', 'unitCost', 'value'], { column: 'value', direction: 'desc' }));
     return { rows: page.data, total: page.total, page: page.page, count: page.count, asOf: cutoff,
          basis: cutoff < today ? 'evidenced_moving_average_history' : 'persisted_moving_average',
          totals: { quantity: rows.reduce((sum, row) => sum.plus(row.quantity), new Decimal(0)).toNumber(), value, generalLedger, difference: (minorUnits(value) - minorUnits(generalLedger)) / 100 } };
}
