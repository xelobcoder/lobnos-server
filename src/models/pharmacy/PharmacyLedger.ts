import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { money } from './PharmacyRules';

export const PHARMACY_ACCOUNTS = {
     sales: 'sales', inventory: 'inventory', cost: 'cost_of_sales', expense: 'operating_expenses', equity: 'opening_equity', payable: 'supplier_payable',
};
export type PharmacyJournalLine = { account: string; debit?: number; credit?: number };

export async function assertPharmacyDayOpen(db: any, branch: number, date: Date | string = new Date()): Promise<string> {
     if (!Number.isInteger(branch) || branch <= 0) throw new Error('Select an operating branch');
     const value = date instanceof Date ? date.toISOString().slice(0, 10) : date.slice(0, 10);
     if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid financial date');
     const day = await db('pharmacy_financial_days').where({ branchid: branch, financial_date: value }).forUpdate().first();
     if (!day) throw new Error('The pharmacy financial day has not been opened. Ask a pharmacy manager or accountant to open it.');
     if (day.status !== 'open') throw new Error('This pharmacy financial day is closed');
     return value;
}

/** Synchronous journal: sale, collection and pharmacy books commit or roll back together. */
export async function postPharmacyJournal(db: any, branch: number, source: string, kind: string, description: string, actor: number, lines: PharmacyJournalLine[], date: Date | string = new Date()): Promise<void> {
     if (!lines.length || lines.some(l => !l.account || !Number.isFinite(l.debit ?? 0) || !Number.isFinite(l.credit ?? 0) || (l.debit ?? 0) < 0 || (l.credit ?? 0) < 0 || ((l.debit ?? 0) > 0 && (l.credit ?? 0) > 0) || money(l.debit ?? 0) !== (l.debit ?? 0) || money(l.credit ?? 0) !== (l.credit ?? 0))) throw new Error('Invalid pharmacy journal lines');
     const balance = lines.reduce((sum, line) => sum.plus(line.debit || 0).minus(line.credit || 0), new Decimal(0));
     if (!balance.isZero()) throw new Error('Pharmacy journal must balance');
     if (!lines.some(line => (line.debit || 0) > 0)) throw new Error('Pharmacy journal requires a positive amount');
     const financialDate = await assertPharmacyDayOpen(db, branch, date);
     const id = randomUUID();
     await db('pharmacy_journals').insert({ id, branchid: branch, source_ref: source, kind, description, financial_date: financialDate, created_by: actor });
     await db('pharmacy_journal_lines').insert(lines.map(line => ({ journal_id: id, account_code: line.account, debit: line.debit || 0, credit: line.credit || 0 })));
}

export async function resolvePharmacyDestination(db: any, branch: number, method: string): Promise<any> {
     const route = await db('pharmacy_payment_routes').where({ branchid: branch, method }).forUpdate().first();
     if (!route) throw new Error('Ask the pharmacy manager to configure this payment method for this branch');
     const account = await db('pharmacy_collection_accounts').where({ id: route.account_id, branchid: branch, is_active: true, currency: 'GHS', account_type: method === 'card' ? 'bank' : method }).forUpdate().first();
     if (!account) throw new Error('The configured pharmacy payment destination is unavailable');
     return account;
}
