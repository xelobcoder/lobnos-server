import KnexConnection from '../../database/KnexConnections';
import { parsePaging } from '../utils/pagination';
import { AccountingError } from '../errors/AccountingErrors';
import {
     BankAccount,
     BankStatementLine,
     IBankReconciliationService,
     ImportResult,
     ImportStatementInput,
     MatchSuggestion,
     ReconciliationSummary,
} from '../interfaces/IBankReconciliationService';
import { ExcelHelper } from '../../utils/ExcelHelper';

const DEFAULT_DAY_TOLERANCE = 5;

export class BankReconciliationService implements IBankReconciliationService {
     constructor(private tenantId: number) { }

     private async connection() {
          return KnexConnection(this.tenantId);
     }

     async listAccounts(): Promise<BankAccount[]> {
          const db = await this.connection();

          const accounts = await db('acc_bank_accounts as b')
               .leftJoin('acc_accounts as a', 'a.account_code', 'b.gl_account_code')
               .select('b.*', 'a.name as gl_account_name')
               .orderBy('b.name', 'asc');

          if (accounts.length === 0) return accounts;

          const stats = await db('acc_bank_statement_lines')
               .whereIn('bank_account_id', accounts.map((account: any) => account.id))
               .groupBy('bank_account_id')
               .select('bank_account_id')
               .select(
                    db.raw('COUNT(*) AS total_lines'),
                    db.raw("SUM(CASE WHEN status = 'unmatched' THEN 1 ELSE 0 END) AS unmatched_lines"),
                    db.raw('MAX(txn_date) AS last_statement_date')
               );

          const byAccount = new Map(stats.map((row: any) => [Number(row.bank_account_id), row]));

          return accounts.map((account: any) => {
               const stat: any = byAccount.get(Number(account.id));
               return {
                    ...account,
                    total_lines: Number(stat?.total_lines || 0),
                    unmatched_lines: Number(stat?.unmatched_lines || 0),
                    last_statement_date: stat?.last_statement_date || null,
               };
          });
     }

     async createAccount(input: any): Promise<BankAccount> {
          const db = await this.connection();

          const account = await db('acc_accounts').where({ account_code: input.gl_account_code }).first();
          if (!account) throw new AccountingError(`Account ${input.gl_account_code} not found`, 'ACCOUNT_NOT_FOUND', 404);

          const [id] = await db('acc_bank_accounts').insert({
               name: input.name,
               bank_name: input.bank_name || null,
               account_number: input.account_number || null,
               gl_account_code: input.gl_account_code,
               branchid: input.branchid ?? null,
               is_active: input.is_active ?? true,
               created_at: new Date(),
          });

          return db('acc_bank_accounts').where({ id }).first();
     }

     async updateAccount(id: number, input: any): Promise<BankAccount> {
          const db = await this.connection();
          const existing = await this.requireAccount(db, id);

          const changes: any = {};
          if (input.name !== undefined) changes.name = input.name;
          if (input.bank_name !== undefined) changes.bank_name = input.bank_name || null;
          if (input.account_number !== undefined) changes.account_number = input.account_number || null;
          if (input.branchid !== undefined) changes.branchid = input.branchid ?? null;
          if (input.is_active !== undefined) changes.is_active = !!input.is_active;

          if (input.gl_account_code !== undefined && input.gl_account_code !== existing.gl_account_code) {
               const matched = await db('acc_bank_statement_lines')
                    .where({ bank_account_id: id })
                    .whereNotNull('matched_journal_line_id')
                    .count('* as total')
                    .first();

               if (Number((matched as any)?.total || 0) > 0) {
                    throw new AccountingError(
                         'This account already has reconciled lines, so its ledger account can no longer be changed',
                         'GL_ACCOUNT_LOCKED',
                         409
                    );
               }

               const account = await db('acc_accounts').where({ account_code: input.gl_account_code }).first();
               if (!account) throw new AccountingError(`Account ${input.gl_account_code} not found`, 'ACCOUNT_NOT_FOUND', 404);
               changes.gl_account_code = input.gl_account_code;
          }

          if (Object.keys(changes).length > 0) {
               await db('acc_bank_accounts').where({ id }).update(changes);
          }

          return db('acc_bank_accounts').where({ id }).first();
     }

     async importStatement(input: ImportStatementInput): Promise<ImportResult> {
          const db = await this.connection();
          return db.transaction(async (trx) => {
               let imported = 0;
               let skipped = 0;

               for (const line of input.lines) {
                    const amount = round2(Number(line.amount));
                    if (!line.txnDate || !isFinite(amount) || amount === 0) {
                         skipped++;
                         continue;
                    }

                    const fingerprint = buildFingerprint(input.bankAccountId, line.txnDate, amount, line.reference);
                    const existing = await trx('acc_bank_statement_lines').where({ fingerprint }).first();
                    if (existing) {
                         skipped++;
                         continue;
                    }

                    await trx('acc_bank_statement_lines').insert({
                         bank_account_id: input.bankAccountId,
                         txn_date: line.txnDate,
                         description: line.description || null,
                         reference: line.reference || null,
                         amount,
                         status: 'unmatched',
                         fingerprint,
                         imported_by: input.importedBy,
                         imported_at: new Date(),
                    });
                    imported++;
               }

               return { imported, skipped };
          });
     }

     async statementLines(
          bankAccountId: number,
          filters: { from?: string; to?: string; status?: string; page?: number; count?: number } = {}
     ) {
          const db = await this.connection();
          const paging = parsePaging(filters, 50);

          const base = db('acc_bank_statement_lines').where({ bank_account_id: bankAccountId });
          if (filters.from) base.where('txn_date', '>=', filters.from);
          if (filters.to) base.where('txn_date', '<=', filters.to);
          if (filters.status) base.where('status', filters.status);

          const totalRow = await base.clone().clearSelect().clearOrder().count('* as total').first();
          const data = await base
               .clone()
               .orderBy([{ column: 'txn_date', order: 'asc' }, { column: 'id', order: 'asc' }])
               .limit(paging.count)
               .offset(paging.offset);

          return { data, total: Number(totalRow?.total || 0), page: paging.page, count: paging.count };
     }

     async unmatchedLedgerLines(bankAccountId: number, from?: string, to?: string): Promise<any[]> {
          const db = await this.connection();
          const bank = await this.requireAccount(db, bankAccountId);

          const query = db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .leftJoin('acc_bank_statement_lines as s', 's.matched_journal_line_id', 'l.id')
               .where('a.account_code', bank.gl_account_code)
               .andWhere('e.status', '!=', 'voided')
               .whereNull('s.id')
               .select(
                    'l.id as journal_line_id',
                    'e.id as journal_entry_id',
                    'e.occurred_at',
                    'e.description',
                    'e.source_module',
                    'l.direction',
                    'l.amount'
               )
               .orderBy('e.occurred_at', 'asc');

          if (from) query.andWhereRaw('DATE(e.occurred_at) >= ?', [from]);
          if (to) query.andWhereRaw('DATE(e.occurred_at) <= ?', [to]);

          const rows = await query;

          return rows.map((row: any) => ({
               ...row,
               signedAmount: row.direction === 'debit' ? Number(row.amount) : -Number(row.amount),
          }));
     }

     async suggestMatches(
          bankAccountId: number,
          from?: string,
          to?: string,
          dayTolerance = DEFAULT_DAY_TOLERANCE
     ): Promise<MatchSuggestion[]> {
          const db = await this.connection();

          const statementLines = await db('acc_bank_statement_lines')
               .where({ bank_account_id: bankAccountId, status: 'unmatched' })
               .modify((builder: any) => {
                    if (from) builder.where('txn_date', '>=', from);
                    if (to) builder.where('txn_date', '<=', to);
               })
               .orderBy('txn_date', 'asc');

          const ledgerLines = await this.unmatchedLedgerLines(bankAccountId, from, to);
          const claimed = new Set<number>();
          const suggestions: MatchSuggestion[] = [];

          for (const line of statementLines) {
               const amount = round2(Number(line.amount));

               const candidates = ledgerLines
                    .filter((ledger) => !claimed.has(ledger.journal_line_id))
                    .filter((ledger) => round2(ledger.signedAmount) === amount)
                    .map((ledger) => ({
                         ledger,
                         dayGap: Math.abs(daysBetween(ledger.occurred_at, line.txn_date)),
                    }))
                    .filter((candidate) => candidate.dayGap <= dayTolerance)
                    .sort((left, right) => left.dayGap - right.dayGap);

               if (candidates.length === 0) continue;

               // an exact tie is ambiguous, so leave it for a person rather than guess
               if (candidates.length > 1 && candidates[0].dayGap === candidates[1].dayGap) continue;

               const best = candidates[0];
               claimed.add(best.ledger.journal_line_id);

               suggestions.push({
                    statementLineId: line.id,
                    journalLineId: best.ledger.journal_line_id,
                    journalEntryId: best.ledger.journal_entry_id,
                    occurredAt: toDateOnly(best.ledger.occurred_at),
                    description: best.ledger.description,
                    amount,
                    dayGap: best.dayGap,
               });
          }

          return suggestions;
     }

     async match(statementLineId: number, journalLineId: number, employeeId: number): Promise<void> {
          const db = await this.connection();

          const alreadyMatched = await db('acc_bank_statement_lines')
               .where({ matched_journal_line_id: journalLineId })
               .whereNot({ id: statementLineId })
               .first();

          if (alreadyMatched) {
               throw new AccountingError('That ledger posting is already matched to another statement line', 'ALREADY_MATCHED', 409);
          }

          await db('acc_bank_statement_lines').where({ id: statementLineId }).update({
               matched_journal_line_id: journalLineId,
               status: 'matched',
               matched_by: employeeId,
               matched_at: new Date(),
          });
     }

     async unmatch(statementLineId: number, employeeId: number): Promise<void> {
          const db = await this.connection();
          await db('acc_bank_statement_lines').where({ id: statementLineId }).update({
               matched_journal_line_id: null,
               status: 'unmatched',
               matched_by: employeeId,
               matched_at: null,
          });
     }

     async ignore(statementLineId: number, employeeId: number): Promise<void> {
          const db = await this.connection();
          await db('acc_bank_statement_lines').where({ id: statementLineId }).update({
               status: 'ignored',
               matched_by: employeeId,
               matched_at: new Date(),
          });
     }

     async summary(bankAccountId: number, asOf: string, statementBalance: number): Promise<ReconciliationSummary> {
          const db = await this.connection();
          const bank = await this.requireAccount(db, bankAccountId);

          const glRow = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .where('a.account_code', bank.gl_account_code)
               .andWhere('e.status', '!=', 'voided')
               .andWhereRaw('DATE(e.occurred_at) <= ?', [asOf])
               .select(
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits")
               )
               .first();

          const glBalance = round2(Number((glRow as any)?.debits || 0) - Number((glRow as any)?.credits || 0));

          const outstanding = await this.unmatchedLedgerLines(bankAccountId, undefined, asOf);
          const outstandingDeposits = round2(
               outstanding.filter((row) => row.signedAmount > 0).reduce((total, row) => total + row.signedAmount, 0)
          );
          const outstandingPayments = round2(
               outstanding.filter((row) => row.signedAmount < 0).reduce((total, row) => total + Math.abs(row.signedAmount), 0)
          );

          const unmatchedStatement = await db('acc_bank_statement_lines')
               .where({ bank_account_id: bankAccountId, status: 'unmatched' })
               .andWhere('txn_date', '<=', asOf)
               .count('* as total')
               .first();

          // the bank has not seen the outstanding items yet, so remove them from the ledger balance
          const adjustedBankBalance = round2(glBalance - outstandingDeposits + outstandingPayments);

          return {
               bankAccountId,
               asOf,
               glBalance,
               statementBalance: round2(Number(statementBalance || 0)),
               outstandingDeposits,
               outstandingPayments,
               adjustedBankBalance,
               difference: round2(adjustedBankBalance - Number(statementBalance || 0)),
               unmatchedStatementLines: Number((unmatchedStatement as any)?.total || 0),
               unmatchedLedgerLines: outstanding.length,
          };
     }

     private async requireAccount(db: any, bankAccountId: number) {
          const bank = await db('acc_bank_accounts').where({ id: bankAccountId }).first();
          if (!bank) throw new AccountingError(`Bank account ${bankAccountId} not found`, 'BANK_ACCOUNT_NOT_FOUND', 404);
          return bank;
     }

     async importExcel(input: { bankAccountId: number; importedBy: number; buffer: Buffer }): Promise<ImportResult> {
          const excel = new ExcelHelper();
          let parsed: { header: string[]; data: Record<string, any>[] };
          try {
               parsed = await excel.parseBuffer(input.buffer, 2);
          } catch (_error) {
               throw new AccountingError('The uploaded file is not a readable .xlsx workbook', 'INVALID_BANK_WORKBOOK', 400);
          }

          const { header, data } = parsed;
          const columns = new Set(header);
          const hasAmount = columns.has('amount');
          const hasDebitCredit = columns.has('debit') && columns.has('credit');

          if (!columns.has('date') || (!hasAmount && !hasDebitCredit)) {
               throw new AccountingError(
                    'The first worksheet must contain date and either amount or both debit and credit columns',
                    'INVALID_BANK_WORKBOOK',
                    400
               );
          }

          const lines: ImportStatementInput['lines'] = [];
          let skipped = 0;
          const problems: string[] = [];
          data.forEach((row: any, index) => {
               const date = excelDate(row.date);
               const amount = hasDebitCredit
                    ? toAmount(row.credit) - toAmount(row.debit)
                    : toAmount(row.amount);
               if (!date || !isFinite(amount) || amount === 0) {
                    skipped++;
                    problems.push(`Row ${index + 2}: ${!date ? 'invalid date' : 'missing or invalid amount'}`);
                    return;
               }
               lines.push({
                    txnDate: date,
                    description: row.description ? String(row.description).trim() : undefined,
                    reference: row.reference ? String(row.reference).trim() : undefined,
                    amount,
               });
          });

          const result = await this.importStatement({ ...input, lines });
          return { imported: result.imported, skipped: result.skipped + skipped, problems };
     }
}

export async function ensureBankTables(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (!(await knex.schema.hasTable('acc_bank_accounts'))) {
          await knex.schema.createTable('acc_bank_accounts', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 120).notNullable();
               table.string('bank_name', 120).nullable();
               table.string('account_number', 60).nullable();
               table.string('gl_account_code', 20).notNullable();
               table.integer('branchid').unsigned().nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('acc_bank_statement_lines'))) {
          await knex.schema.createTable('acc_bank_statement_lines', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('bank_account_id').unsigned().notNullable();
               table.date('txn_date').notNullable();
               table.string('description', 255).nullable();
               table.string('reference', 120).nullable();
               table.decimal('amount', 14, 2).notNullable();
               table.enum('status', ['unmatched', 'matched', 'ignored']).notNullable().defaultTo('unmatched');
               table.integer('matched_journal_line_id').unsigned().nullable();
               table.integer('matched_by').unsigned().nullable();
               table.datetime('matched_at').nullable();
               table.string('fingerprint', 190).notNullable().unique();
               table.integer('imported_by').unsigned().nullable();
               table.datetime('imported_at').notNullable().defaultTo(knex.fn.now());
               table.index(['bank_account_id', 'status'], 'idx_bank_line_account_status');
               table.index(['bank_account_id', 'txn_date'], 'idx_bank_line_account_date');
          });
     }
}

function buildFingerprint(bankAccountId: number, txnDate: string, amount: number, reference?: string | null): string {
     return [bankAccountId, toDateOnly(txnDate), amount.toFixed(2), (reference || '').trim().toLowerCase()].join('|');
}

function daysBetween(start: Date | string, end: Date | string): number {
     const startMs = new Date(start).getTime();
     const endMs = new Date(end).getTime();
     if (!isFinite(startMs) || !isFinite(endMs)) return Number.MAX_SAFE_INTEGER;
     return Math.round((endMs - startMs) / 86_400_000);
}

function toDateOnly(date: Date | string): string {
     return new Date(date).toISOString().split('T')[0];
}

function toAmount(value: unknown): number {
     if (value === null || value === undefined || String(value).trim() === '') return 0;
     return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function excelDate(value: unknown): string | null {
     if (value instanceof Date && isFinite(value.getTime())) return toDateOnly(value);
     if (typeof value === 'number') {
          const date = new Date(Math.round((value - 25569) * 86400 * 1000));
          return isFinite(date.getTime()) ? toDateOnly(date) : null;
     }
     if (typeof value !== 'string' || !value.trim()) return null;
     const text = value.trim();
     const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
     if (match) {
          const [, first, second, year] = match;
          const day = Number(first) > 12 ? Number(first) : Number(second);
          const month = Number(first) > 12 ? Number(second) : Number(first);
          const date = new Date(Number(year), month - 1, day);
          if (date.getFullYear() === Number(year) && date.getMonth() === month - 1 && date.getDate() === day) {
               return toDateOnly(date);
          }
          return null;
     }
     const parsed = new Date(text);
     return isFinite(parsed.getTime()) ? toDateOnly(parsed) : null;
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}
