import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { AccountingPeriodService } from '../../../accountingModule/services/AccountingPeriodService';
import { PharmacyAccountingCore, accountingDate, amount, fail, positiveId, text } from './PharmacyAccountingCore';

export class PharmacyAccountingReconciliation extends PharmacyAccountingCore {
     private async bank(db: Knex | Knex.Transaction, id: number): Promise<any> {
          const row = await db('pharmacy_collection_accounts').where({ id, branchid: this.context.branch, is_active: true, currency: 'GHS' }).forUpdate().first();
          if (!row || row.account_type !== 'bank') fail('Select an active pharmacy bank account in this branch', 'NOT_FOUND', 404);
          return row;
     }
     private book(db: Knex | Knex.Transaction, accountId: number) {
          return db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
               .where({ 'j.branchid': this.context.branch, 'l.account_code': 'collection:' + accountId });
     }
     async list(query: any): Promise<any> {
          if (query.statementId) {
               const statement = await this.db('pharmacy_accounting_statements').where({ id: String(query.statementId), branchid: this.context.branch }).first();
               if (!statement) fail('Statement not found in this branch', 'NOT_FOUND', 404);
               const [lines, ledgerLines] = await Promise.all([
                    this.db('pharmacy_accounting_statement_lines').where({ statement_id: statement.id, branchid: this.context.branch }).orderBy('financial_date').orderBy('id'),
                    this.book(this.db, statement.account_id).whereBetween('j.financial_date', [accountingDate(statement.start_date), accountingDate(statement.end_date)])
                         .select('l.id', 'l.journal_id', 'l.debit', 'l.credit', 'j.financial_date', 'j.description', 'j.source_ref').orderBy('j.financial_date').orderBy('l.id'),
               ]);
               const matched = await this.db('pharmacy_accounting_statement_lines').where({ branchid: this.context.branch, account_id: statement.account_id }).whereNotNull('journal_line_id').select('journal_line_id');
               const used = new Set(matched.map(l => Number(l.journal_line_id)));
               return { statement, items: lines, ledgerLines: ledgerLines.map(l => ({ ...l, amount: new Decimal(l.debit).minus(l.credit).toFixed(2), matched: used.has(Number(l.id)) })) };
          }
          return { items: await this.db('pharmacy_accounting_statements').where({ branchid: this.context.branch }).orderBy('created_at', 'desc').limit(200),
               accounts: await this.db('pharmacy_collection_accounts').where({ branchid: this.context.branch, account_type: 'bank', is_active: true, currency: 'GHS' }).select('id', 'name', 'account_type', 'currency') };
     }
     async importStatement(input: any): Promise<any> {
          return this.atomic(input, 'reconciliation:import', async trx => {
               const accountId = positiveId(input.accountId), reference = text(input.reference, 'statement reference', 128);
               await this.bank(trx, accountId);
               const start = accountingDate(input.startDate), end = accountingDate(input.endDate);
               if (end < start) fail('Statement endDate precedes startDate');
               const opening = amount(input.openingBalance, true, true), closing = amount(input.closingBalance, true, true);
               if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 2000) fail('Import 1-2000 statement lines');
               if (await trx('pharmacy_accounting_statements').where({ branchid: this.context.branch, account_id: accountId }).where('start_date', '<=', end).where('end_date', '>=', start).forUpdate().first()) fail('Statement dates overlap an existing import', 'STATEMENT_OVERLAP', 409);
               const id = randomUUID(), refs = new Set<string>();
               const lines = input.lines.map((l: any) => {
                    const ref = text(l.reference, 'bank transaction reference', 128), date = accountingDate(l.date), value = amount(l.amount, true);
                    if (date < start || date > end || refs.has(ref)) fail('Statement lines must have unique references and dates within the statement');
                    refs.add(ref);
                    return { id: randomUUID(), statement_id: id, branchid: this.context.branch, account_id: accountId, reference: ref, financial_date: date, amount: value, description: l.description == null ? null : text(l.description, 'statement line description') };
               });
               if (!lines.reduce((s: Decimal, l: any) => s.plus(l.amount), new Decimal(opening)).eq(closing)) fail('Opening balance plus signed statement movements must equal closing balance', 'STATEMENT_UNBALANCED', 409);
               if (await trx('pharmacy_accounting_statement_lines').where({ branchid: this.context.branch, account_id: accountId }).whereIn('reference', [...refs]).forUpdate().first()) fail('Bank transaction reference already imported', 'DUPLICATE_REFERENCE', 409);
               const row = { id, branchid: this.context.branch, account_id: accountId, reference, start_date: start, end_date: end, opening_balance: opening, closing_balance: closing, status: 'imported', created_by: this.context.actor };
               await trx('pharmacy_accounting_statements').insert(row);
               // Chunk to avoid driver parameter limits for large imports.
               for (let i = 0; i < lines.length; i += 100) await trx('pharmacy_accounting_statement_lines').insert(lines.slice(i, i + 100));
               await this.audit(trx, 'reconciliation:import', id, null, { ...row, lineCount: lines.length });
               return { id, status: 'imported', lineCount: lines.length };
          });
     }
     async match(input: any): Promise<any> {
          return this.atomic(input, 'reconciliation:match', async trx => {
               const statement = await trx('pharmacy_accounting_statements').where({ id: input.statementId, branchid: this.context.branch }).forUpdate().first();
               if (!statement) fail('Statement not found in this branch', 'NOT_FOUND', 404);
               if (statement.status !== 'imported') fail('Finalized statements are immutable', 'INVALID_STATE', 409);
               await this.bank(trx, statement.account_id);
               const line = await trx('pharmacy_accounting_statement_lines').where({ id: input.statementLineId, statement_id: statement.id, branchid: this.context.branch }).forUpdate().first();
               if (!line) fail('Statement line not found', 'NOT_FOUND', 404);
               if (line.journal_line_id != null) fail('Statement line is already matched', 'ALREADY_MATCHED', 409);
               const journalLineId = positiveId(input.journalLineId);
               const book = await this.book(trx, statement.account_id).where('l.id', journalLineId)
                    .whereBetween('j.financial_date', [accountingDate(statement.start_date), accountingDate(statement.end_date)])
                    .select('l.*', 'j.financial_date').forUpdate().first();
               if (!book) fail('Journal line is not in this branch, bank account or statement period', 'NOT_FOUND', 404);
               if (!new Decimal(book.debit).minus(book.credit).eq(line.amount)) fail('Signed journal amount must exactly match statement amount', 'AMOUNT_MISMATCH', 409);
               if (await trx('pharmacy_accounting_statement_lines').where({ journal_line_id: journalLineId }).forUpdate().first()) fail('Journal line already matched to a statement', 'ALREADY_MATCHED', 409);
               await trx('pharmacy_accounting_statement_lines').where({ id: line.id, branchid: this.context.branch }).update({ journal_line_id: journalLineId, matched_by: this.context.actor, matched_at: new Date() });
               const result = { statementId: statement.id, statementLineId: line.id, journalLineId, matched: true };
               await this.audit(trx, 'reconciliation:match', statement.id, line, result); return result;
          });
     }
     async finalize(input: any): Promise<any> {
          return this.atomic(input, 'reconciliation:finalize', async trx => {
               const statement = await trx('pharmacy_accounting_statements').where({ id: input.statementId, branchid: this.context.branch }).forUpdate().first();
               if (!statement) fail('Statement not found in this branch', 'NOT_FOUND', 404);
               if (statement.status !== 'imported') fail('Statement is already finalized', 'INVALID_STATE', 409);
               if (Number(statement.created_by) === this.context.actor) fail('Statement importer cannot finalize their own reconciliation', 'APPROVAL_SEPARATION', 403);
               const reason = text(input.reason, 'finalization evidence');
               await this.bank(trx, statement.account_id);
               // Same period lock used by posting, to serialize this check with concurrent journals.
               const start = accountingDate(statement.start_date), end = accountingDate(statement.end_date);
               for (let month = start.slice(0, 7); month <= end.slice(0, 7);) {
                    await new AccountingPeriodService(this.context.tenantId).lockPeriodForDate(month + '-01', trx);
                    const next = new Date(month + '-01T00:00:00.000Z'); next.setUTCMonth(next.getUTCMonth() + 1); month = next.toISOString().slice(0, 7);
               }
               const lines = await trx('pharmacy_accounting_statement_lines').where({ statement_id: statement.id, branchid: this.context.branch }).forUpdate();
               if (lines.some(l => l.journal_line_id == null)) fail('Every statement line must be matched before finalization', 'UNMATCHED_LINES', 409);
               const book = await this.book(trx, statement.account_id).where('j.financial_date', '<=', end).select('l.id', 'l.debit', 'l.credit', 'j.financial_date').forUpdate();
               const opening = book.filter(l => accountingDate(l.financial_date) < start).reduce((s, l) => s.plus(l.debit).minus(l.credit), new Decimal(0));
               const closing = book.reduce((s, l) => s.plus(l.debit).minus(l.credit), new Decimal(0));
               const ids = new Set(lines.map(l => Number(l.journal_line_id)));
               if (book.some(l => accountingDate(l.financial_date) >= start && !ids.has(Number(l.id)))) fail('Unmatched bank ledger movements remain in the statement period', 'UNMATCHED_LEDGER', 409);
               if (!opening.eq(statement.opening_balance) || !closing.eq(statement.closing_balance)) fail('Statement opening and closing balances must reconcile exactly to pharmacy bank books', 'BALANCE_MISMATCH', 409);
               const next = { status: 'finalized', finalized_by: this.context.actor, finalized_at: new Date() };
               await trx('pharmacy_accounting_statements').where({ id: statement.id, branchid: this.context.branch }).update(next);
               await this.audit(trx, 'reconciliation:finalize', statement.id, statement, { ...next, reason });
               return { id: statement.id, status: 'finalized', openingBalance: opening.toFixed(2), closingBalance: closing.toFixed(2) };
          });
     }
}
