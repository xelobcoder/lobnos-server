from pathlib import Path
p=Path('src/accountingModule/services/AccountingReportService.ts');s=p.read_text(encoding='utf-8');s=s.replace("const COST_OF_SALES_CODES", "import { minorUnits, sumMinor } from '../utils/money';\n\nconst COST_OF_SALES_CODES",1)
a=s.index('     async receivableAging(');b=s.index('     async cashFlow(',a)
s=s[:a]+'''     async receivableAging(asOf?: string) { return this.controlAccountAging('AR', asOf); }
     async payableAging(asOf?: string) { return this.controlAccountAging('AP', asOf); }

     /** Posted movements are authoritative, so historical aging always ties to its GL control. */
     private async controlAccountAging(ledger: 'AR' | 'AP', asOf?: string) {
          const db = await this.connection();
          const cutoff = asOf || new Date().toISOString().slice(0, 10);
          const movements = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .where('a.account_code', ledger === 'AR' ? 'acc-1002' : 'acc-2000')
               .whereNot('e.status', 'voided').whereRaw('DATE(e.occurred_at) <= ?', [cutoff])
               .select('l.*', 'e.occurred_at', 'e.source_table', 'e.source_pk', 'e.source_ref')
               .orderBy('e.occurred_at', 'asc').orderBy('l.id', 'asc');
          const metadata = await db('acc_subledger_entries').where({ ledger }).where('document_date', '<=', cutoff).select('*');
          const sources = new Map(metadata.map((row: any) => [`${row.source_table}:${row.source_ref}`, row]));
          const billIds = [...new Set(movements.map((row: any) => Number(row.billingid)).filter(Boolean))];
          const bills = billIds.length ? await db('billing').whereIn('billingid', billIds).select('billingid', 'patientid') : [];
          const patients = new Map(bills.map((row: any) => [Number(row.billingid), row.patientid]));
          // Expenses include commissions, utilities and other obligations, not only inventory receipts.
          const expenseIds = [...new Set(movements.map((row: any) => Number(row.expense_id)).filter(Boolean))];
          const expenses = expenseIds.length ? await db('expensesrecord').whereIn('id', expenseIds).select('*') : [];
          const expenseById = new Map(expenses.map((row: any) => [Number(row.id), row]));
          const documents = new Map<string, { reference: string; partyId: any; amount: number; date: any; key: string }>();
          for (const movement of movements) {
               const ref = movement.source_ref || String(movement.source_pk);
               const meta: any = sources.get(`${movement.source_table}:${ref}`);
               const expense: any = expenseById.get(Number(movement.expense_id));
               const partyId = ledger === 'AR' ? patients.get(Number(movement.billingid)) ?? meta?.party_id ?? null : meta?.party_id ?? expense?.merchantid ?? expense?.merchant ?? null;
               const partyType = ledger === 'AR' ? 'patient' : meta?.party_type || (expense ? 'merchant' : 'unassigned');
               const reference = movement.billingid ? `BILL-${movement.billingid}` : movement.expense_id ? `EXP-${movement.expense_id}` : meta?.document_ref || `${movement.source_table}:${ref}`;
               const key = `${partyType}:${partyId ?? 'unassigned'}:${reference}`;
               const previous = documents.get(key);
               const amount = minorUnits(movement.amount) * (movement.direction === (ledger === 'AR' ? 'debit' : 'credit') ? 1 : -1);
               documents.set(key, { key: `${partyType}:${partyId ?? reference}`, reference, partyId, amount: (previous?.amount || 0) + amount, date: previous?.date || movement.occurred_at });
          }
          const groups = new Map<string, Array<any>>();
          for (const doc of documents.values()) { if (!groups.has(doc.key)) groups.set(doc.key, []); groups.get(doc.key)!.push(doc); }
          const items: Array<any> = [];
          for (const docs of groups.values()) {
               const charges = docs.filter(doc => doc.amount > 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
               let credit = -docs.filter(doc => doc.amount < 0).reduce((sum, doc) => sum + doc.amount, 0);
               for (const doc of charges) {
                    const applied = Math.min(credit, doc.amount); credit -= applied;
                    if (doc.amount > applied) items.push({ reference: doc.reference, partyId: doc.partyId, amount: (doc.amount - applied) / 100, age: daysBetween(doc.date, cutoff) });
               }
               if (credit) items.push({ reference: `Unapplied credit: ${docs[0].key}`, partyId: docs[0].partyId, amount: -credit / 100, age: 0 });
          }
          const result = bucketise(items);
          const generalLedger = sumMinor(movements.map((row: any) => (row.direction === (ledger === 'AR' ? 'debit' : 'credit') ? 1 : -1) * Number(row.amount))) / 100;
          return { ...result, basis: 'accrual', reconciliation: { generalLedger, difference: (minorUnits(result.totals.total) - minorUnits(generalLedger)) / 100 } };
     }

'''+s[b:]
a=s.index('     async cashFlow(');b=s.index('     async periodBreakdown(',a)
s=s[:a]+'''     async cashFlow(from: string, to: string): Promise<CashFlowStatement> {
          const db = await this.connection();
          const cashLines = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .join('acc_accounts as a', 'l.account_id', 'a.id')
               .whereIn('a.account_code', CASH_ACCOUNTS).whereNot('e.status', 'voided')
               .whereRaw('DATE(e.occurred_at) >= ?', [from]).whereRaw('DATE(e.occurred_at) <= ?', [to])
               .select('e.id as entry_id', 'l.direction', 'l.amount');
          const netByEntry = new Map<number, number>();
          for (const line of cashLines) netByEntry.set(Number(line.entry_id), (netByEntry.get(Number(line.entry_id)) || 0) + minorUnits(line.amount) * (line.direction === 'debit' ? 1 : -1));
          const entryIds = [...netByEntry.keys()].filter(id => netByEntry.get(id) !== 0);
          const buckets = new Map<string, CashFlowLine>();
          if (entryIds.length) {
               const counterparts = await db('acc_journal_lines as l').join('acc_accounts as a', 'l.account_id', 'a.id')
                    .whereIn('l.journal_entry_id', entryIds).whereNotIn('a.account_code', CASH_ACCOUNTS)
                    .select('l.journal_entry_id', 'l.amount', 'l.direction', 'a.account_code', 'a.name', 'a.type');
               // Preserve signed counterparts: no proportional assumptions or per-share rounding.
               for (const line of counterparts) {
                    const category = classifyCashFlow(line.account_code, line.type), key = `${category}:${line.account_code}`;
                    const amount = minorUnits(line.amount) * (line.direction === 'credit' ? 1 : -1);
                    const previous = buckets.get(key);
                    buckets.set(key, { category, accountCode: line.account_code, accountName: line.name, amount: (previous?.amount || 0) + amount });
               }
          }
          const lines = [...buckets.values()].filter(line => line.amount !== 0).map(line => ({ ...line, amount: line.amount / 100 }));
          const sumBy = (category: CashFlowLine['category']) => sumMinor(lines.filter(line => line.category === category).map(line => line.amount)) / 100;
          const openingCash = await this.cashBalanceAsOf(previousDay(from)), closingCash = await this.cashBalanceAsOf(to);
          const netMovement = (minorUnits(closingCash) - minorUnits(openingCash)) / 100;
          const allocated = sumMinor(lines.map(line => line.amount));
          return { lines, totals: { operating: sumBy('operating'), investing: sumBy('investing'), financing: sumBy('financing'), netMovement, openingCash, closingCash },
               reconciliation: { difference: (minorUnits(netMovement) - allocated) / 100, balanced: minorUnits(netMovement) === allocated } };
     }

'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('src/accountingModule/interfaces/IAccountingReportService.ts');s=p.read_text(encoding='utf-8');s=s.replace('partyId: number | null;', 'partyId: number | string | null;');s=s.replace('export interface CashFlowStatement {',"export interface CashFlowStatement {\n     reconciliation?: { difference: number; balanced: boolean };");s=s.replace('Outstanding supplier balances bucketed by the age of the purchase order receipt.', 'Posted supplier and expense obligations at the cutoff, including unapplied credits.');p.write_text(s,encoding='utf-8')
