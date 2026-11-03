import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import { allocateMinor, minorUnits } from '../../../accountingModule/utils/money';
import { PharmacyAccountingCore, accountingDate, fail, stableHash } from './PharmacyAccountingCore';
import { pharmacyAccount } from './PharmacyAccountingCatalogue';
import { json } from '../PharmacyEnterpriseCore';
import { PharmacyJournalLine } from '../PharmacyLedger';

export const TAX_CREDIT_POLICY = 'original_gross_proportional_v1';
const currency = (cents: number): string => {
     const negative = cents < 0; const n = Math.abs(cents);
     return (negative ? '-' : '') + Math.floor(n / 100) + '.' + String(n % 100).padStart(2, '0');
};
const sumCents = (rows: any[], field: string): number => {
     const value = Number(rows.reduce((sum, row) => sum + BigInt(minorUnits(row[field])), BigInt(0)));
     if (!Number.isSafeInteger(value)) fail('Tax allocation history is outside supported currency precision', 'TAX_HISTORY_MISMATCH', 409);
     return value;
};
/** Exact largest-remainder distribution with frozen weights and remaining-capacity caps. */
export function cappedTaxCreditMinor(total: number, weights: number[], caps: number[]): number[] {
     if (!Number.isSafeInteger(total) || total < 0 || weights.length !== caps.length || weights.some(v => !Number.isSafeInteger(v) || v < 0) || caps.some(v => !Number.isSafeInteger(v) || v < 0) || total > caps.reduce((s, v) => s + v, 0)) fail('Credit exceeds original gross residual capacity', 'TAX_CREDIT_LIMIT', 409);
     const result = weights.map(() => 0);
     let left = total, active = weights.map((_, i) => i).filter(i => weights[i] > 0 && caps[i] > 0);
     while (left > 0) {
          if (!active.length) fail('No original gross capacity remains', 'TAX_CREDIT_LIMIT', 409);
          const shares = allocateMinor(left, active.map(i => weights[i]));
          const saturated = active.filter((i, j) => shares[j] > caps[i]);
          if (!saturated.length) { active.forEach((i, j) => { result[i] = shares[j]; }); break; }
          for (const i of saturated) { result[i] = caps[i]; left -= caps[i]; }
          active = active.filter(i => !saturated.includes(i));
     }
     return result;
}
/** Cumulative original-snapshot ratio, rounded HALF_UP using integer arithmetic only. */
export function taxCreditMinor(gross: number, tax: number, usedGross: number, usedTax: number, creditGross: number): number {
     if (![gross, tax, usedGross, usedTax, creditGross].every(Number.isSafeInteger) || gross < 1 || tax < 0 || tax > gross || usedTax < 0 || usedTax > tax || usedGross < usedTax || usedGross > gross || usedGross - usedTax > gross - tax || creditGross < 0 || creditGross > gross - usedGross) fail('Frozen tax credit residual is inconsistent', 'TAX_HISTORY_MISMATCH', 409);
     const numerator = BigInt(usedGross + creditGross) * BigInt(tax), denominator = BigInt(gross);
     const cumulativeTarget = Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2)));
     const remainingTax = tax - usedTax, remainingNet = gross - tax - (usedGross - usedTax);
     // Reversing an arbitrary earlier credit may leave a rounded cumulative residual.
     // Bounds preserve both frozen net and tax capacities, and exhaust them exactly on full credit.
     const lower = Math.max(0, creditGross - remainingNet), upper = Math.min(creditGross, remainingTax);
     return Math.max(lower, Math.min(upper, cumulativeTarget - usedTax));
}
export class PharmacyAccountingTaxCredits extends PharmacyAccountingCore {
     async snapshots(trx: Knex.Transaction, sale: any): Promise<any> {
          const events = await trx('pharmacy_tax_events').where({ branchid: this.context.branch, sale_id: sale.id, event_type: 'sale' }).orderBy('id').forUpdate();
          const total = minorUnits(sale.total_amount);
          let frozenGross = 0;
          const components = events.map(e => {
               const gross = minorUnits(e.gross_amount), net = minorUnits(e.net_amount), tax = minorUnits(e.tax_amount);
               if (gross < 0 || net < 0 || tax < 0 || net + tax !== gross || !e.local_account || !e.sale_line_id || !Number.isFinite(Number(e.rate)) || Number(e.rate) < 0 || Number(e.rate) > 100) fail('Original sale tax snapshot is inconsistent', 'INVALID_TAX_SNAPSHOT', 409);
               frozenGross += gross;
               return { ref: e.id, eventId: e.id, lineId: e.sale_line_id, gross, net, tax, rate: String(e.rate), account: e.local_account };
          }).filter(c => c.gross > 0);
          if (frozenGross > total || total <= 0) fail('Frozen sale tax gross does not reconcile to original invoice', 'INVALID_TAX_SNAPSHOT', 409);
          if (components.some(c => c.tax > 0)) {
               const posted = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where({ 'j.branchid': this.context.branch, 'j.source_ref': sale.id, 'j.kind': 'sale' }).select('l.account_code', 'l.debit', 'l.credit');
               for (const account of [...new Set(components.map(c => c.account))]) {
                    const expected = components.filter(c => c.account === account).reduce((s, c) => s + c.tax, 0);
                    const actual = posted.filter(l => l.account_code === account).reduce((s, l) => s + minorUnits(l.credit) - minorUnits(l.debit), 0);
                    if (actual !== expected) fail('Frozen tax snapshot does not match the originally posted tax liability', 'TAX_SOURCE_MISMATCH', 409);
               }
          }
          if (total > frozenGross) components.push({ ref: 'untaxed', eventId: null, lineId: null, gross: total - frozenGross, net: total - frozenGross, tax: 0, rate: null, account: null });
          return { components, taxed: components.some(c => c.tax > 0), hash: stableHash({ total, components }) };
     }
     async credit(trx: Knex.Transaction, sale: any, document: any, settings: { enabled: boolean; mappings: Record<string, string> }): Promise<{ lines: PharmacyJournalLine[]; net: string; tax: string }> {
          const snapshot = await this.snapshots(trx, sale);
          if (snapshot.taxed && (document.details.taxPolicy !== TAX_CREDIT_POLICY || document.details.taxSnapshotHash !== snapshot.hash)) fail('Credit policy or frozen tax snapshot changed; submit a newly reviewed credit', 'TAX_POLICY_CHANGED', 409);
          if (document.details.taxSnapshotHash && document.details.taxSnapshotHash !== snapshot.hash) fail('Frozen invoice snapshot changed after credit approval', 'TAX_POLICY_CHANGED', 409);
          const history = await trx('pharmacy_accounting_tax_adjustments').where({ branchid: this.context.branch, sale_id: sale.id }).forUpdate();
          if (history.some(h => accountingDate(h.financial_date) > accountingDate(document.financial_date))) fail('Credit cannot predate existing tax allocation/reversal evidence', 'BACKDATED_TAX_CREDIT', 409);
          if (snapshot.taxed) {
               const older = await trx('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind: 'ar_adjustment', status: 'posted' }).whereNot('id', document.id).select('id', 'details');
               if (older.some(d => { const detail = json(d.details); return detail.saleId === sale.id && detail.adjustmentKind === 'credit' && !history.some(h => h.source_credit_id === d.id && h.event_type === 'credit'); })) fail('Earlier credits lack frozen tax allocation evidence; reviewed reconciliation required', 'TAX_HISTORY_RECONCILIATION_REQUIRED', 409);
          }
          const components = snapshot.components.map(c => {
               const rows = history.filter(h => h.component_ref === c.ref);
               const usedGross = sumCents(rows, 'gross_amount'), usedTax = sumCents(rows, 'tax_amount');
               taxCreditMinor(c.gross, c.tax, usedGross, usedTax, 0); // validate immutable residual history
               return { ...c, usedGross, usedTax };
          });
          const gross = minorUnits(document.amount), shares = cappedTaxCreditMinor(gross, components.map(c => c.gross), components.map(c => c.gross - c.usedGross));
          const rows: any[] = [], taxLines: PharmacyJournalLine[] = [];
          let totalTax = 0;
          for (let i = 0; i < components.length; i++) {
               const c = components[i], assigned = shares[i]; if (!assigned) continue;
               const tax = taxCreditMinor(c.gross, c.tax, c.usedGross, c.usedTax, assigned), net = assigned - tax;
               if (tax > 0) {
                    const account = await pharmacyAccount(trx, this.context.branch, settings, c.account, true);
                    if (account.type !== 'liability') fail('Original tax account must remain an active liability account', 'TAX_ACCOUNT_REQUIRED', 409);
                    taxLines.push({ account: c.account, debit: Number(currency(tax)), documentRef: sale.id });
               }
               totalTax += tax;
               rows.push({ id: randomUUID(), branchid: this.context.branch, sale_id: sale.id, credit_document_id: document.id, source_credit_id: document.id, component_ref: c.ref, tax_event_id: c.eventId, sale_line_id: c.lineId, event_type: 'credit', policy: TAX_CREDIT_POLICY, financial_date: accountingDate(document.financial_date), gross_amount: currency(assigned), net_amount: currency(net), tax_amount: currency(tax), original_gross_amount: currency(c.gross), original_net_amount: currency(c.net), original_tax_amount: currency(c.tax), rate: c.rate, local_account: c.account, created_by: this.context.actor });
          }
          if (rows.length) await trx('pharmacy_accounting_tax_adjustments').insert(rows);
          const net = currency(gross - totalTax);
          return { lines: [...(gross > totalTax ? [{ account: document.details.account, debit: Number(net), documentRef: sale.id }] : []), ...taxLines], net, tax: currency(totalTax) };
     }
     async reverse(trx: Knex.Transaction, originalId: string, reversal: any): Promise<void> {
          const rows = await trx('pharmacy_accounting_tax_adjustments').where({ branchid: this.context.branch, credit_document_id: originalId, event_type: 'credit' }).orderBy('id').forUpdate();
          if (!rows.length) return; // A pre-policy, untaxed credit may have no tax evidence.
          for (const row of rows) {
               if (await trx('pharmacy_accounting_tax_adjustments').where({ reversal_of_adjustment_id: row.id }).first()) fail('Tax credit evidence is already reversed', 'ALREADY_REVERSED', 409);
               const { id, created_at, ...data } = row;
               await trx('pharmacy_accounting_tax_adjustments').insert({ ...data, id: randomUUID(), credit_document_id: reversal.id, event_type: 'reversal', financial_date: accountingDate(reversal.financial_date), gross_amount: currency(-minorUnits(row.gross_amount)), net_amount: currency(-minorUnits(row.net_amount)), tax_amount: currency(-minorUnits(row.tax_amount)), reversal_of_adjustment_id: row.id, created_by: this.context.actor });
          }
     }
     async register(query: any = {}): Promise<any> {
          const q = this.db('pharmacy_accounting_tax_adjustments').where({ branchid: this.context.branch });
          if (query.saleId) q.where('sale_id', String(query.saleId));
          if (query.sourceCreditId) q.where('source_credit_id', String(query.sourceCreditId));
          if (query.from) q.where('financial_date', '>=', accountingDate(query.from));
          if (query.to) q.where('financial_date', '<=', accountingDate(query.to));
          const limit = Math.min(200, Math.max(1, Math.floor(Number(query.limit) || 100))), offset = Math.max(0, Math.floor(Number(query.offset) || 0));
          const [items, totals] = await Promise.all([
               q.clone().orderBy('financial_date', 'desc').orderBy('id').limit(limit).offset(offset),
               q.clone().sum('gross_amount as gross').sum('net_amount as net').sum('tax_amount as tax').count('* as count').first(),
          ]);
          return { items, totals: { count: Number(totals?.count || 0), gross: currency(minorUnits(totals?.gross || 0)), net: currency(minorUnits(totals?.net || 0)), tax: currency(minorUnits(totals?.tax || 0)) }, limit, offset, policy: TAX_CREDIT_POLICY };
     }
}
