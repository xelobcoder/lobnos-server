import KnexConnection from '../../database/KnexConnections';
import { ensureAccountingSchema } from '../init/accountingSchemaInit';
import {
     AgingRow,
     ISubledgerService,
     PartyBalance,
     SubledgerEntry,
     SubledgerEntryInput,
     SubledgerName,
} from '../interfaces/ISubledgerService';

const CONTROL_ACCOUNTS: Record<SubledgerName, string> = {
     AR: 'acc-1002',
     AP: 'acc-2000',
};

export class SubledgerService implements ISubledgerService {
     constructor(private tenantId: number) { }

     private async connection(trx?: any) {
          if (trx) return trx;
          await ensureAccountingSchema(this.tenantId);
          return KnexConnection(this.tenantId);
     }

     async record(entry: SubledgerEntryInput, trx?: any): Promise<void> {
          const db = await this.connection(trx);
          if (!entry.amount || Number(entry.amount) === 0) return;

          await db('acc_subledger_entries')
               .insert({
                    ledger: entry.ledger,
                    party_type: entry.partyType,
                    party_id: entry.partyId ?? null,
                    party_name: entry.partyName ?? null,
                    document_type: entry.documentType,
                    document_ref: entry.documentRef,
                    document_date: toDateOnly(entry.documentDate),
                    due_date: entry.dueDate ? toDateOnly(entry.dueDate) : null,
                    amount: round2(Number(entry.amount)),
                    gross_amount: round2(Number(entry.grossAmount ?? entry.amount)),
                    tax_amount: round2(Number(entry.taxAmount || 0)),
                    source_module: entry.sourceModule,
                    source_table: entry.sourceTable,
                    source_ref: entry.sourceRef,
                    branchid: entry.branchid ?? null,
                    created_at: new Date(),
               })
               .onConflict(['ledger', 'source_table', 'source_ref'])
               .ignore();
     }

     async balances(ledger: SubledgerName, asOf?: string): Promise<PartyBalance[]> {
          const db = await this.connection();

          const query = db('acc_subledger_entries')
               .where({ ledger })
               .groupBy('party_type', 'party_id', 'party_name')
               .orderBy('party_name', 'asc')
               .select(
                    'party_type',
                    'party_id',
                    'party_name',
                    db.raw('COUNT(*) AS documents'),
                    db.raw('COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS charged'),
                    db.raw('COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS settled'),
                    db.raw('COALESCE(SUM(amount), 0) AS balance'),
                    db.raw('MIN(document_date) AS oldest_document_date')
               );

          if (asOf) query.andWhere('document_date', '<=', asOf);

          const rows = await query;

          return rows.map((row: any) => ({
               partyType: row.party_type,
               partyId: row.party_id ? Number(row.party_id) : null,
               partyName: row.party_name,
               documents: Number(row.documents || 0),
               charged: round2(Number(row.charged || 0)),
               settled: round2(Number(row.settled || 0)),
               balance: round2(Number(row.balance || 0)),
               oldestDocumentDate: row.oldest_document_date ? toDateOnly(row.oldest_document_date) : null,
          }));
     }

     async aging(ledger: SubledgerName, asOf?: string) {
          const db = await this.connection();
          const cutoff = asOf || new Date().toISOString().split('T')[0];

          const query = db('acc_subledger_entries')
               .where({ ledger })
               .andWhere('document_date', '<=', cutoff)
               .orderBy([{ column: 'document_date', order: 'asc' }, { column: 'id', order: 'asc' }]);

          const entries = await query;
          const byParty = new Map<string, any[]>();

          for (const entry of entries) {
               const key = `${entry.party_type}:${entry.party_id ?? 'none'}`;
               if (!byParty.has(key)) byParty.set(key, []);
               byParty.get(key)!.push(entry);
          }

          const rows: AgingRow[] = [];

          for (const partyEntries of byParty.values()) {
               const open = partyEntries
                    .filter((entry) => Number(entry.amount) > 0)
                    .map((entry) => ({ entry, remaining: round2(Number(entry.amount)) }));

               let credit = round2(
                    partyEntries
                         .filter((entry) => Number(entry.amount) < 0)
                         .reduce((total, entry) => total + Math.abs(Number(entry.amount)), 0)
               );

               for (const document of open) {
                    if (credit <= 0) break;
                    const applied = Math.min(credit, document.remaining);
                    document.remaining = round2(document.remaining - applied);
                    credit = round2(credit - applied);
               }

               for (const document of open) {
                    if (document.remaining <= 0) continue;

                    const ageDays = daysBetween(document.entry.document_date, cutoff);
                    rows.push({
                         partyType: document.entry.party_type,
                         partyId: document.entry.party_id ? Number(document.entry.party_id) : null,
                         partyName: document.entry.party_name,
                         reference: document.entry.document_ref,
                         documentDate: toDateOnly(document.entry.document_date),
                         ageDays,
                         current: ageDays <= 0 ? document.remaining : 0,
                         days30: ageDays > 0 && ageDays <= 30 ? document.remaining : 0,
                         days60: ageDays > 30 && ageDays <= 60 ? document.remaining : 0,
                         days90: ageDays > 60 && ageDays <= 90 ? document.remaining : 0,
                         over90: ageDays > 90 ? document.remaining : 0,
                         total: document.remaining,
                    });
               }
          }

          rows.sort((left, right) => right.total - left.total);

          const totals = {
               current: round2(rows.reduce((sum, row) => sum + row.current, 0)),
               days30: round2(rows.reduce((sum, row) => sum + row.days30, 0)),
               days60: round2(rows.reduce((sum, row) => sum + row.days60, 0)),
               days90: round2(rows.reduce((sum, row) => sum + row.days90, 0)),
               over90: round2(rows.reduce((sum, row) => sum + row.over90, 0)),
               total: round2(rows.reduce((sum, row) => sum + row.total, 0)),
          };

          return { rows, totals };
     }

     async statement(
          ledger: SubledgerName,
          partyType: string,
          partyId: number,
          from?: string,
          to?: string
     ): Promise<{ entries: Array<SubledgerEntry & { runningBalance: number }>; openingBalance: number; closingBalance: number }> {
          const db = await this.connection();

          const openingRow = from
               ? await db('acc_subledger_entries')
                    .where({ ledger, party_type: partyType, party_id: partyId })
                    .andWhere('document_date', '<', from)
                    .sum('amount as total')
                    .first()
               : null;

          const openingBalance = round2(Number(openingRow?.total || 0));

          const query = db('acc_subledger_entries')
               .where({ ledger, party_type: partyType, party_id: partyId })
               .orderBy([{ column: 'document_date', order: 'asc' }, { column: 'id', order: 'asc' }]);

          if (from) query.andWhere('document_date', '>=', from);
          if (to) query.andWhere('document_date', '<=', to);

          const rows = await query;

          let running = openingBalance;
          const entries = rows.map((row: any) => {
               running = round2(running + Number(row.amount));
               return { ...row, runningBalance: running };
          });

          return { entries, openingBalance, closingBalance: running };
     }

     async reconcile(ledger: SubledgerName, asOf?: string) {
          const db = await this.connection();

          const subledgerRow = await db('acc_subledger_entries')
               .where({ ledger })
               .modify((builder: any) => {
                    if (asOf) builder.andWhere('document_date', '<=', asOf);
               })
               .sum('amount as total')
               .first();

          const controlCode = CONTROL_ACCOUNTS[ledger];
          const glRow = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .where('a.account_code', controlCode)
               .andWhere('e.status', '!=', 'voided')
               .modify((builder: any) => {
                    if (asOf) builder.andWhereRaw('DATE(e.occurred_at) <= ?', [asOf]);
               })
               .select(
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits")
               )
               .first();

          const debits = Number(glRow?.debits || 0);
          const credits = Number(glRow?.credits || 0);
          const generalLedger = round2(ledger === 'AR' ? debits - credits : credits - debits);
          const subledger = round2(Number(subledgerRow?.total || 0));

          return { subledger, generalLedger, difference: round2(subledger - generalLedger) };
     }
}

export async function recordSubledgerEntry(
     tenantId: number,
     db: any,
     entry: SubledgerEntryInput
): Promise<void> {
     await new SubledgerService(tenantId).record(entry, db);
}

function daysBetween(start: Date | string, end: Date | string): number {
     const startMs = new Date(start).getTime();
     const endMs = new Date(end).getTime();
     if (!isFinite(startMs) || !isFinite(endMs)) return 0;
     return Math.floor((endMs - startMs) / 86_400_000);
}

function toDateOnly(date: Date | string): string {
     return new Date(date).toISOString().split('T')[0];
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}
