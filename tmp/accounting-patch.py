from pathlib import Path
p=Path('src/accountingModule/utils/money.ts')
p.write_text('''import { AccountingError } from '../errors/AccountingErrors';

/** Validate persisted currency at its two-decimal boundary; tolerate only binary float noise. */
export function minorUnits(value: unknown): number {
  if (value === null || value === '' || typeof value === 'boolean' || !['number', 'string'].includes(typeof value)) throw new AccountingError('Invalid monetary amount', 'INVALID_AMOUNT', 400);
  const amount = Number(value), scaled = amount * 100, cents = Math.round(scaled);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || Math.abs(scaled - cents) > 0.00001 || Math.abs(cents) > 99999999999999) throw new AccountingError('Amounts must be finite and have at most two decimal places', 'INVALID_AMOUNT', 400);
  return cents;
}
export function sumMinor(values: unknown[]): number {
  const total = values.reduce<number>((sum, value) => sum + minorUnits(value), 0);
  if (!Number.isSafeInteger(total)) throw new AccountingError('Monetary total is too large', 'INVALID_AMOUNT', 400);
  return total;
}
/** Whole-pesewa allocation, with deterministic ties and an exact sum. */
export function allocateMinor(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || weights.some(n => !Number.isSafeInteger(n) || n < 0)) throw new AccountingError('Invalid allocation', 'INVALID_AMOUNT', 400);
  const denominator = weights.reduce((a, b) => a + BigInt(b), BigInt(0));
  if (!denominator) {
    if (total) throw new AccountingError('Cash flow has no counterpart', 'UNRECONCILED_CASH_FLOW', 409);
    return weights.map(() => 0);
  }
  const sign = Math.sign(total), magnitude = BigInt(Math.abs(total));
  const shares = weights.map((weight, index) => ({ index, amount: Number(magnitude * BigInt(weight) / denominator), remainder: magnitude * BigInt(weight) % denominator }));
  let left = Math.abs(total) - shares.reduce((sum, share) => sum + share.amount, 0);
  for (const share of [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) { if (left-- <= 0) break; share.amount++; }
  return shares.map(share => sign * share.amount);
}
''',encoding='utf-8')
p=Path('src/accountingModule/services/AccountingService.ts');s=p.read_text(encoding='utf-8')
s=s.replace("const BALANCE_TOLERANCE = 0.01;", "import { minorUnits, sumMinor } from '../utils/money';\nimport { AccountingError } from '../errors/AccountingErrors';")
needle='''          const existing = await this.repository.findJournalEntryBySource('''
s=s.replace(needle,'''          // All validation and the period check share the posting transaction and its lock.
          if (!input.trx) {
               const db = await KnexConnection(input.tenantId);
               return db.transaction((trx) => this.postTransaction({ ...input, trx }));
          }
          const normalised = input.lines.map(line => {
               const amount = minorUnits(line.amount);
               if (amount < 0 || ![NormalBalance.DEBIT, NormalBalance.CREDIT].includes(line.direction)) throw new AccountingError('Invalid journal line', 'INVALID_JOURNAL_LINE', 400);
               return { ...line, amount: amount / 100 };
          });
          input = { ...input, lines: normalised };
          await new AccountingPeriodService(input.tenantId).assertPostingAllowed(input.occurredAt || new Date(), input.trx);

'''+needle,1)
s=s.replace('''          await new AccountingPeriodService(input.tenantId).assertPostingAllowed(
               input.occurredAt || new Date(),
               input.trx
          );

''','')
s=s.replace('const totalDebits = round2(sumByDirection(input.lines, NormalBalance.DEBIT));','const totalDebits = sumMinor(input.lines.filter(line => line.direction === NormalBalance.DEBIT).map(line => line.amount));')
s=s.replace('const totalCredits = round2(sumByDirection(input.lines, NormalBalance.CREDIT));','const totalCredits = sumMinor(input.lines.filter(line => line.direction === NormalBalance.CREDIT).map(line => line.amount));')
s=s.replace('Math.abs(totalDebits - totalCredits) > BALANCE_TOLERANCE','totalDebits !== totalCredits').replace('new UnbalancedTransactionError(totalDebits, totalCredits)','new UnbalancedTransactionError(totalDebits / 100, totalCredits / 100)')
s=s.replace('''          const original = await this.repository.findJournalEntryById''','''          if (!input.trx) {
               const db = await KnexConnection(input.tenantId);
               return db.transaction((trx) => this.reverse({ ...input, trx }));
          }
          // Serialize reversals of the same entry, including concurrent retries.
          await input.trx('acc_journal_entries').where({ id: input.journalEntryId }).forUpdate().first();
          const original = await this.repository.findJournalEntryById''',1)
s=s[:s.index('\nfunction sumByDirection')]+ '\n'
p.write_text(s,encoding='utf-8')
# Period locking and atomic close/audit.
p=Path('src/accountingModule/services/AccountingPeriodService.ts');s=p.read_text(encoding='utf-8')
s=s.replace('PeriodClosedError,', 'AccountingError, PeriodClosedError,')
s=s.replace('''          const period = await this.ensurePeriodForDate(date, trx);
          if (period''','''          await this.ensurePeriodForDate(date, trx);
          const db = await this.connection(trx);
          const period = await db('acc_periods').where({ period_code: toPeriodCode(new Date(date)) }).forUpdate().first();
          if (period''')
s=s.replace('''          const db = await this.connection();
          const period = await db('acc_periods').where({ period_code: periodCode }).first();
          if (!period) throw new PeriodNotFoundError(periodCode);

          if (BLOCKING_STATUSES.includes(status)) {''','''          const connection = await this.connection();
          return connection.transaction(async (db: any) => {
          const period = await db('acc_periods').where({ period_code: periodCode }).forUpdate().first();
          if (!period) throw new PeriodNotFoundError(periodCode);

          if (BLOCKING_STATUSES.includes(status)) {
               const pending = await db('acc_posting_outbox').whereNot({ status: 'posted' }).whereRaw("DATE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.occurredAt'))) BETWEEN ? AND ?", [period.period_start, period.period_end]).first();
               if (pending) throw new AccountingError('Resolve pending or failed accounting postings before closing this period', 'UNPOSTED_TRANSACTIONS', 409);''')
s=s.replace('this.getPeriodTotals(periodCode);','this.getPeriodTotals(periodCode, db);')
s=s.replace('''          return db('acc_periods').where({ period_code: periodCode }).first();
     }

     async getPeriodTotals''','''          await db('acc_control_audit').insert({ action: 'period_status', entity_id: period.id, employee_id: employeeId ?? null, before_state: JSON.stringify(period), after_state: JSON.stringify({ status, notes: notes ?? period.notes }), created_at: new Date() });
          return db('acc_periods').where({ period_code: periodCode }).first();
          });
     }

     async getPeriodTotals''')
s=s.replace('async getPeriodTotals(periodCode: string)', 'async getPeriodTotals(periodCode: string, trx?: any)').replace("          const db = await this.connection();\n          const period = await db('acc_periods').where({ period_code: periodCode }).first();", "          const db = await this.connection(trx);\n          const period = await db('acc_periods').where({ period_code: periodCode }).first();")
p.write_text(s,encoding='utf-8')
# Append-only control events; existing tenants get this via schema bootstrap.
p=Path('src/accountingModule/init/accountingSchemaInit.ts');s=p.read_text(encoding='utf-8');needle="     if (!(await knex.schema.hasTable('acc_accounts'))) {";s=s.replace(needle,"""     if (!(await knex.schema.hasTable('acc_control_audit'))) {
          await knex.schema.createTable('acc_control_audit', table => {
               table.increments('id').primary();
               table.string('action', 40).notNullable();
               table.integer('entity_id').unsigned().notNullable();
               table.integer('employee_id').unsigned().nullable();
               table.text('before_state').notNullable();
               table.text('after_state').notNullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.index(['action', 'entity_id']);
          });
     }

"""+needle,1);p.write_text(s,encoding='utf-8')
