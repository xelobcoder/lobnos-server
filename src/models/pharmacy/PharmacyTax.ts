import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import type { PharmacyJournalLine } from './PharmacyLedger';

export async function ensurePharmacyTaxSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('pharmacy_tax_rules')) await db.schema.createTable('pharmacy_tax_rules', table => {
          table.string('id', 36).primary(); table.integer('branchid').unsigned().notNullable(); table.string('item_id', 64).notNullable();
          table.decimal('rate', 9, 4).notNullable(); table.string('local_account', 100).notNullable(); table.date('effective_date').notNullable();
          table.string('reason', 1000).notNullable(); table.boolean('is_active').notNullable().defaultTo(true);
          table.integer('created_by').unsigned().notNullable(); table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          table.unique(['branchid', 'item_id', 'effective_date'], 'uq_pharmacy_tax_item_date');
     });
     if (!await db.schema.hasTable('pharmacy_tax_events')) await db.schema.createTable('pharmacy_tax_events', table => {
          table.string('id', 36).primary(); table.integer('branchid').unsigned().notNullable(); table.string('sale_id', 36).notNullable(); table.string('sale_line_id', 36).notNullable();
          table.string('rule_id', 36).notNullable(); table.string('event_type', 12).notNullable(); table.date('financial_date').notNullable();
          table.decimal('gross_amount', 14, 2).notNullable(); table.decimal('net_amount', 14, 2).notNullable(); table.decimal('tax_amount', 14, 2).notNullable();
          table.decimal('rate', 9, 4).notNullable(); table.string('local_account', 100).notNullable(); table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          table.unique(['sale_line_id', 'event_type'], 'uq_pharmacy_tax_line_event'); table.index(['branchid', 'financial_date']);
     });
}

export function inclusivePharmacyTax(gross: number, rate: number) {
     if (!Number.isFinite(gross) || gross < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100 || !new Decimal(rate).equals(new Decimal(rate).toDecimalPlaces(4))) throw new Error('Invalid tax-inclusive amount or configured rate');
     const tax = new Decimal(gross).mul(rate).div(new Decimal(100).plus(rate)).toDecimalPlaces(2);
     return { gross, net: new Decimal(gross).minus(tax).toNumber(), tax: tax.toNumber() };
}

export async function pharmacyTaxJournalLines(db: Knex.Transaction, branch: number, saleId: string, kind: string, lines: PharmacyJournalLine[], date: string): Promise<PharmacyJournalLine[]> {
     if (!['sale', 'refund'].includes(kind)) return lines;
     const events: Array<{ sale_line_id: string; rule_id: string; gross_amount: number; net_amount: number; tax_amount: number; rate: number; local_account: string }> = [];
     if (kind === 'sale') {
          const rules = await db('pharmacy_tax_rules').where({ branchid: branch, is_active: true }).where('effective_date', '<=', date).orderBy('effective_date', 'desc').forUpdate();
          if (!rules.length) return lines;
          const sold = await db('pharmacy_sale_lines').where({ sale_id: saleId }).select('id', 'inventory_item_id', 'line_total');
          for (const item of sold) {
               const rule = rules.find(row => row.item_id === item.inventory_item_id);
               if (!rule) continue;
               const tax = inclusivePharmacyTax(Number(item.line_total), Number(rule.rate));
               events.push({ sale_line_id: item.id, rule_id: rule.id, gross_amount: tax.gross, net_amount: tax.net, tax_amount: tax.tax, rate: Number(rule.rate), local_account: rule.local_account });
          }
     } else {
          const original = await db('pharmacy_tax_events').where({ branchid: branch, sale_id: saleId, event_type: 'sale' }).forUpdate();
          events.push(...original.map(row => ({ sale_line_id: row.sale_line_id, rule_id: row.rule_id, gross_amount: Number(row.gross_amount), net_amount: Number(row.net_amount), tax_amount: Number(row.tax_amount), rate: Number(row.rate), local_account: row.local_account })));
     }
     if (!events.length) return lines;
     const total = events.reduce((sum, event) => sum.plus(event.tax_amount), new Decimal(0)), direction = kind === 'sale' ? 'credit' : 'debit';
     const salesLine = lines.find(line => line.account === 'sales' && Number(line[direction]) > 0);
     if (!salesLine || total.gt(salesLine[direction]!)) throw new Error('Tax allocation does not reconcile to sale revenue');
     await db('pharmacy_tax_events').insert(events.map(event => ({ id: randomUUID(), branchid: branch, sale_id: saleId, event_type: kind, financial_date: date, ...event })));
     if (kind === 'sale' && total.gt(0)) {
          await db('pharmacy_sales').where({ id: saleId, branchid: branch }).update({ gross_profit: db.raw('gross_profit - ?', [total.toNumber()]) });
          for (const event of events) if (event.tax_amount > 0) await db('pharmacy_sale_lines').where({ id: event.sale_line_id, sale_id: saleId }).update({ gross_profit: db.raw('gross_profit - ?', [event.tax_amount]) });
     }
     return lines.map(line => line === salesLine ? { ...line, [direction]: new Decimal(line[direction]!).minus(total).toNumber() } : line)
          .concat(events.filter(event => event.tax_amount > 0).map(event => ({ account: event.local_account, [direction]: event.tax_amount, documentRef: saleId })));
}
