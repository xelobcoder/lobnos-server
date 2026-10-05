import KnexConnection from '../../database/KnexConnections';
import { parsePaging, parseSort, paginate } from '../utils/pagination';
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

     async balances(ledger: SubledgerName, asOf?: string, options?: { page?: number; count?: number; sortby?: string }) {
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
          const patientIds = [...new Set(rows
               .filter((row: any) => row.party_type === 'patient' && Number(row.party_id) > 0)
               .map((row: any) => Number(row.party_id)))];
          const patientRows = patientIds.length
               ? await db('new_patients')
                    .select('patientid', 'fullpatientid', 'firstname', 'middlename', 'lastname')
                    .whereIn('patientid', patientIds)
               : [];
          const patientById = new Map<number, any>(patientRows.map((patient: any) => [Number(patient.patientid), patient]));

          const mapped: PartyBalance[] = rows.map((row: any) => ({
               partyType: row.party_type,
               partyId: row.party_id ? Number(row.party_id) : null,
               partyName: row.party_name || (row.party_type === 'patient'
                    ? [patientById.get(Number(row.party_id))?.firstname, patientById.get(Number(row.party_id))?.middlename, patientById.get(Number(row.party_id))?.lastname].filter(Boolean).join(' ') || null
                    : null),
               patientIdentifier: patientById.get(Number(row.party_id))?.fullpatientid || null,
               documents: Number(row.documents || 0),
               charged: round2(Number(row.charged || 0)),
               settled: round2(Number(row.settled || 0)),
               balance: round2(Number(row.balance || 0)),
               oldestDocumentDate: row.oldest_document_date ? toDateOnly(row.oldest_document_date) : null,
          }));

          const nonzeroBalances = mapped.filter((row) => Math.abs(row.balance) > 0.001);
          const paging = parsePaging(options || {}, 50);
          const sort = parseSort(options || {}, ['partyName', 'documents', 'charged', 'settled', 'balance', 'oldestDocumentDate'], {
               column: 'balance',
               direction: 'desc',
          });

          return paginate(nonzeroBalances, paging, sort);
     }

     async aging(ledger: SubledgerName, asOf?: string, options?: {
          page?: number;
          count?: number;
          sortby?: string;
          search?: string;
          patientId?: number | string;
          ageBucket?: string;
          from?: string;
          to?: string;
     }) {
          const db = await this.connection();
          const cutoff = asOf || new Date().toISOString().split('T')[0];

          const query = db('acc_subledger_entries')
               .where({ ledger })
               .andWhere('document_date', '<=', cutoff)
               .orderBy([{ column: 'document_date', order: 'asc' }, { column: 'id', order: 'asc' }]);

          const entries = await query;
          const patientIds = [...new Set(entries
               .filter((entry: any) => entry.party_type === 'patient' && Number(entry.party_id) > 0)
               .map((entry: any) => Number(entry.party_id)))];
          const patientRows = patientIds.length
               ? await db('new_patients')
                    .select('patientid', 'fullpatientid', 'firstname', 'middlename', 'lastname')
                    .whereIn('patientid', patientIds)
               : [];
          const patientById = new Map<number, any>(patientRows.map((patient: any) => [Number(patient.patientid), patient]));
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
                    const patient = document.entry.party_type === 'patient'
                         ? patientById.get(Number(document.entry.party_id)) as any
                         : undefined;
                    const patientName = patient
                         ? [patient.firstname, patient.middlename, patient.lastname].filter(Boolean).join(' ')
                         : document.entry.party_name;
                    rows.push({
                         partyType: document.entry.party_type,
                         partyId: document.entry.party_id ? Number(document.entry.party_id) : null,
                         partyName: patientName || document.entry.party_name,
                         patientIdentifier: patient?.fullpatientid || null,
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

          const search = String(options?.search || '').trim().toLocaleLowerCase();
          const patientIdFilter = String(options?.patientId || '').trim();
          const ageBucket = String(options?.ageBucket || '').trim();
          const from = String(options?.from || '').trim();
          const to = String(options?.to || '').trim();
          const validBuckets = new Set(['current', 'days30', 'days60', 'days90', 'over90']);
          const filteredRows = rows.filter((row: any) => {
               if (from && row.documentDate < from) return false;
               if (to && row.documentDate > to) return false;
               if (patientIdFilter && String(row.partyId ?? '') !== patientIdFilter) return false;
               if (validBuckets.has(ageBucket) && Number(row[ageBucket] || 0) <= 0) return false;
               if (!search) return true;
               return [row.partyName, row.partyId, row.patientIdentifier, row.reference]
                    .some((value) => String(value ?? '').toLocaleLowerCase().includes(search));
          });

          const totals = {
               current: round2(filteredRows.reduce((sum, row) => sum + row.current, 0)),
               days30: round2(filteredRows.reduce((sum, row) => sum + row.days30, 0)),
               days60: round2(filteredRows.reduce((sum, row) => sum + row.days60, 0)),
               days90: round2(filteredRows.reduce((sum, row) => sum + row.days90, 0)),
               over90: round2(filteredRows.reduce((sum, row) => sum + row.over90, 0)),
               total: round2(filteredRows.reduce((sum, row) => sum + row.total, 0)),
          };

          const paging = parsePaging(options || {}, 50);
          const sort = parseSort(
               options || {},
               ['partyName', 'partyId', 'patientIdentifier', 'reference', 'documentDate', 'ageDays', 'current', 'days30', 'days60', 'days90', 'over90', 'total'],
               { column: 'documentDate', direction: 'desc' }
          );
          const page = paginate(filteredRows, paging, sort);

          // totals stay whole-report figures so the aging buckets do not change as you page
          return { rows: page.data, total: page.total, page: page.page, count: page.count, totals };
     }

     async statement(
          ledger: SubledgerName,
          partyType: string,
          partyId: number,
          from?: string,
          to?: string,
          options?: { page?: number; count?: number }
     ): Promise<any> {
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

          // the running balance has to be computed across the whole statement before slicing,
          // otherwise page two would restart from zero
          const paging = parsePaging(options || {}, 50);

          return {
               entries: entries.slice(paging.offset, paging.offset + paging.count),
               total: entries.length,
               page: paging.page,
               count: paging.count,
               openingBalance,
               closingBalance: running,
          };
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
