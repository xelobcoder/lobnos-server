import { Knex } from 'knex';
import { accountGroup } from './PharmacyFinancialReports';
import { money } from './PharmacyRules';
import { pharmacyAccountDisplay } from './PharmacyAccountDisplay';

export interface PharmacyLedgerFilters {
     from?: string;
     to?: string;
     account?: string;
     search?: string;
     page?: string | number;
     count?: string | number;
     all?: string | boolean;
}

export function pharmacyAccountingDate(value: unknown, label: string): string {
     if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
          throw new Error(`Enter a valid ${label} in YYYY-MM-DD format`);
     }
     return value;
}

export async function pharmacyGeneralLedger(db: Knex | Knex.Transaction, branch: number, input: PharmacyLedgerFilters) {
     if (!Number.isSafeInteger(branch) || branch <= 0) throw new Error('An operating branch is required');
     const from = input.from ? pharmacyAccountingDate(input.from, 'start date') : undefined;
     const to = input.to ? pharmacyAccountingDate(input.to, 'end date') : new Date().toISOString().slice(0, 10);
     if (from && from > to) throw new Error('The start date must be on or before the end date');
     const page = Number(input.page || 1), count = Number(input.count || 50);
     if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('Invalid ledger page or count');
     const account = String(input.account || '').trim(), search = String(input.search || '').trim();
     if (account.length > 100 || search.length > 100) throw new Error('Ledger account and search must not exceed 100 characters');
     const compactReference = /^[a-z][a-z0-9]{1,15}-([0-9a-f]{8})$/i.exec(search);
     const searchTerm = compactReference ? compactReference[1] : search;
     const source = db('pharmacy_journal_lines as l')
          .join('pharmacy_journals as j', 'j.id', 'l.journal_id')
          .where('j.branchid', branch)
          .where('j.financial_date', '<=', to)
          .select('l.id', 'j.id as journal_id', 'j.financial_date as date', 'j.source_ref as reference',
               'j.kind', 'j.description', 'j.created_at as posting_created_at', 'l.account_code as account', db.raw('COALESCE(l.document_ref, j.source_ref) as source_document'),
               'j.branchid', 'l.debit', 'l.credit',
               db.raw('SUM(l.debit - l.credit) OVER (PARTITION BY l.account_code ORDER BY j.financial_date, j.created_at, j.id, l.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS signed_running_balance'));
     if (account) source.where('l.account_code', account);
     const filtered = () => {
          const query = db.from(source.clone().as('ledger'));
          if (from) query.where('date', '>=', from);
          if (search) query.where(builder => builder.where('description', 'like', `%${search}%`)
               .orWhere('reference', 'like', `%${search}%`).orWhere('account', 'like', `%${search}%`)
               .orWhereRaw('LOWER(??) LIKE ?', ['journal_id', `%${searchTerm.toLowerCase()}%`])
               .orWhereRaw('LOWER(??) LIKE ?', ['source_document', `%${searchTerm.toLowerCase()}%`]));
          return query;
     };
     const totalRow = await filtered().count('* as total').first(), total = Number(totalRow?.total || 0);
     const all = input.all === true || input.all === 'true';
     if (all && total > 10000) throw new Error('Ledger exports are limited to 10,000 rows. Narrow the date range or account filter');
     const query = filtered().select('*').orderBy('date').orderBy('posting_created_at').orderBy('journal_id').orderBy('id');
     if (!all) query.limit(count).offset((page - 1) * count);
     const rawRows = await query;
     const balances = async (before?: string) => {
          const q = db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where('j.branchid', branch).where('j.financial_date', '<=', to);
          if (before) q.where('j.financial_date', '<', before);
          if (account) q.where('l.account_code', account);
          return q.select('l.account_code as account').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code');
     };
     const closing = await balances(), opening = from ? await balances(from) : [];
     const codes = [...new Set([...rawRows.map(row => String(row.account)), ...closing.map(row => String(row.account)), ...(account ? [account] : [])])];
     const display = await pharmacyAccountDisplay(db, branch, codes);
     const normalBalance = (code: string) => display.get(code)?.normalBalance || (['Revenue', 'Liabilities', 'Equity'].includes(accountGroup(code)) ? 'credit' : 'debit');
     const normal = (code: string, debit: unknown, credit: unknown) => money((Number(debit) - Number(credit)) * (normalBalance(code) === 'credit' ? -1 : 1));
     const rows = rawRows.map(row => ({
          ...row, account_name: display.get(row.account)?.name, normal_balance: normalBalance(row.account),
          business_unit: 'pharmacy', debit: Number(row.debit), credit: Number(row.credit),
          running_balance: normal(row.account, row.signed_running_balance, 0),
     }));
     return {
          rows, total, page: all ? 1 : page, count: all ? total : count, totalPages: all ? 1 : Math.max(1, Math.ceil(total / count)),
          openingBalance: account ? normal(account, opening[0]?.debit || 0, opening[0]?.credit || 0) : null,
          closingBalance: account ? normal(account, closing[0]?.debit || 0, closing[0]?.credit || 0) : null,
          accountBalances: closing.map(row => ({ account: row.account, opening: normal(row.account, opening.find(value => value.account === row.account)?.debit || 0, opening.find(value => value.account === row.account)?.credit || 0), closing: normal(row.account, row.debit, row.credit) })),
     };
}
