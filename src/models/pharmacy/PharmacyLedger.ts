import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { money } from './PharmacyRules';
import { synchronizePharmacyJournal } from './PharmacyAccountingBridge';
import { pharmacyTaxJournalLines } from './PharmacyTax';
import { json } from './PharmacyEnterpriseCore';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';

export const PHARMACY_ACCOUNTS = {
     sales: 'sales', inventory: 'inventory', cost: 'cost_of_sales', expense: 'operating_expenses', equity: 'opening_equity', payable: 'supplier_payable',
};
export type PharmacyJournalLine = { account: string; debit?: number; credit?: number; documentRef?: string };

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
     if (typeof source !== 'string' || !source.trim() || source.length > 128 || typeof kind !== 'string' || !kind.trim() || kind.length > 32 || typeof description !== 'string' || !description.trim() || description.length > 500 || !Number.isSafeInteger(actor) || actor <= 0) throw new Error('Invalid pharmacy journal identity or actor');
     if (!Array.isArray(lines) || lines.some(line => !line || typeof line.account !== 'string' || line.account.length > 100 || (line.documentRef !== undefined && (typeof line.documentRef !== 'string' || !line.documentRef.trim() || line.documentRef.length > 128)))) throw new Error('Invalid pharmacy journal account or document reference');
     if (!lines.length || lines.some(l => !l.account || !Number.isFinite(l.debit ?? 0) || !Number.isFinite(l.credit ?? 0) || (l.debit ?? 0) < 0 || (l.credit ?? 0) < 0 || ((l.debit ?? 0) > 0 && (l.credit ?? 0) > 0) || money(l.debit ?? 0) !== (l.debit ?? 0) || money(l.credit ?? 0) !== (l.credit ?? 0))) throw new Error('Invalid pharmacy journal lines');
     const balance = lines.reduce((sum, line) => sum.plus(line.debit || 0).minus(line.credit || 0), new Decimal(0));
     if (!balance.isZero()) throw new Error('Pharmacy journal must balance');
     if (!lines.some(line => (line.debit || 0) > 0)) throw new Error('Pharmacy journal requires a positive amount');
     const financialDate = await assertPharmacyDayOpen(db, branch, date);
     for (const id of [...new Set(lines.filter(line => line.account.startsWith('collection:')).map(line => Number(line.account.slice(11))))].sort((a, b) => a - b)) {
          if (!Number.isSafeInteger(id) || id < 1 || !await db('pharmacy_collection_accounts').where({ id, branchid: branch }).forUpdate().first()) throw new Error('Collection account does not belong to this pharmacy branch');
          const finalized = await db('pharmacy_accounting_statements').where({ branchid: branch, account_id: id, status: 'finalized' }).where('end_date', '>=', financialDate).forUpdate().first();
          if (finalized) throw new AccountingError('This bank statement has been finalized; post a correction after its closing date', 'BANK_STATEMENT_FINALIZED', 409);
     }
     lines = await pharmacyTaxJournalLines(db, branch, source, kind, lines, financialDate);
     const id = randomUUID();
     const journal = { id, branchid: branch, source_ref: source, kind, description, financial_date: financialDate, created_by: actor };
     await db('pharmacy_journals').insert(journal);
     await db('pharmacy_journal_lines').insert(lines.map(line => ({ journal_id: id, account_code: line.account, debit: line.debit || 0, credit: line.credit || 0, ...(line.documentRef ? { document_ref: line.documentRef } : {}) })));
     await synchronizePharmacyJournal(db, journal, lines);
}

export async function assertPharmacySaleRefundable(db: any, branch: number, saleId: string): Promise<void> {
     const adjustments = await db('pharmacy_accounting_documents').where({ branchid: branch, kind: 'ar_adjustment', status: 'posted' })
          .whereRaw('details LIKE ?', [`%${saleId}%`]).select('details').forUpdate();
     if (adjustments.some((row: { details: unknown }) => json(row.details).saleId === saleId)) throw new AccountingError('Reverse the approved invoice credits or write-offs before refunding the original sale', 'INVOICE_ADJUSTMENT_REVERSAL_REQUIRED', 409);
}

export async function resolvePharmacyDestination(db: any, branch: number, method: string): Promise<any> {
     const route = await db('pharmacy_payment_routes').where({ branchid: branch, method }).forUpdate().first();
     if (!route) throw new Error('Ask the pharmacy manager to configure this payment method for this branch');
     const account = await db('pharmacy_collection_accounts').where({ id: route.account_id, branchid: branch, is_active: true, currency: 'GHS', account_type: method === 'card' ? 'bank' : method }).forUpdate().first();
     if (!account) throw new Error('The configured pharmacy payment destination is unavailable');
     return account;
}
