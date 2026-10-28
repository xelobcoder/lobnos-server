from pathlib import Path
p=Path('src/accountingModule/services/BankReconciliationService.ts');s=p.read_text(encoding='utf-8');s=s.replace("const DEFAULT_DAY_TOLERANCE", "import { minorUnits } from '../utils/money';\nimport { ensureIndexes } from '../../database/ensureIndexes';\n\nconst DEFAULT_DAY_TOLERANCE",1)
a=s.index('     async match(');b=s.index('     async summary(',a)
s=s[:a]+'''     async match(statementLineId: number, journalLineId: number, employeeId: number): Promise<void> {
          const connection = await this.connection();
          await connection.transaction(async (db: any) => {
               const statement = await db('acc_bank_statement_lines').where({ id: statementLineId }).forUpdate().first();
               if (!statement) throw new AccountingError('Statement line not found', 'STATEMENT_LINE_NOT_FOUND', 404);
               const line = await db('acc_journal_lines').where({ id: journalLineId }).forUpdate().first();
               if (!line) throw new AccountingError('Ledger line not found', 'JOURNAL_LINE_NOT_FOUND', 404);
               const bank = await this.requireAccount(db, statement.bank_account_id);
               const account = await db('acc_accounts').where({ id: line.account_id }).first();
               const entry = await db('acc_journal_entries').where({ id: line.journal_entry_id }).first();
               if (!bank.is_active || account?.account_code !== bank.gl_account_code || !entry || entry.status === 'voided' ||
                    (bank.branchid != null && Number(line.branchid) !== Number(bank.branchid))) {
                    throw new AccountingError('The posting does not belong to this active bank account and location', 'INVALID_BANK_MATCH', 400);
               }
               const signed = minorUnits(line.amount) * (line.direction === 'debit' ? 1 : -1);
               if (!signed || signed !== minorUnits(statement.amount)) throw new AccountingError('Statement and ledger amounts must match, including direction', 'INVALID_BANK_MATCH', 400);
               if (statement.status === 'matched' && Number(statement.matched_journal_line_id) === journalLineId) return;
               if (statement.status !== 'unmatched' || statement.matched_journal_line_id != null) throw new AccountingError('Unmatch or restore this statement line first', 'ALREADY_MATCHED', 409);
               const alreadyMatched = await db('acc_bank_statement_lines').where({ matched_journal_line_id: journalLineId }).forUpdate().first();
               if (alreadyMatched) throw new AccountingError('That ledger posting is already matched', 'ALREADY_MATCHED', 409);
               const after = { matched_journal_line_id: journalLineId, status: 'matched', matched_by: employeeId, matched_at: new Date() };
               await db('acc_bank_statement_lines').where({ id: statementLineId }).update(after);
               await this.audit(db, 'bank_match', statement, after, employeeId);
          });
     }

     private async audit(db: any, action: string, before: any, after: any, employeeId: number) {
          await db('acc_control_audit').insert({ action, entity_id: before.id, employee_id: employeeId, before_state: JSON.stringify(before), after_state: JSON.stringify(after), created_at: new Date() });
     }

     private async changeStatementState(statementLineId: number, employeeId: number, status: 'unmatched' | 'ignored') {
          const connection = await this.connection();
          await connection.transaction(async (db: any) => {
               const before = await db('acc_bank_statement_lines').where({ id: statementLineId }).forUpdate().first();
               if (!before) throw new AccountingError('Statement line not found', 'STATEMENT_LINE_NOT_FOUND', 404);
               if (status === 'ignored' && before.status === 'matched') throw new AccountingError('Unmatch this line before ignoring it', 'ALREADY_MATCHED', 409);
               const after = { matched_journal_line_id: null, status, matched_by: employeeId, matched_at: null };
               await db('acc_bank_statement_lines').where({ id: statementLineId }).update(after);
               await this.audit(db, status === 'ignored' ? 'bank_ignore' : 'bank_unmatch', before, after, employeeId);
          });
     }
     async unmatch(statementLineId: number, employeeId: number): Promise<void> { await this.changeStatementState(statementLineId, employeeId, 'unmatched'); }
     async ignore(statementLineId: number, employeeId: number): Promise<void> { await this.changeStatementState(statementLineId, employeeId, 'ignored'); }

'''+s[b:]
# Add unique index; duplicates require review, no automatic rewriting of matches.
needle="\nfunction round2("
# place migration at end ensureBankTables before helper by identify
start=s.index('export async function ensureBankTables');end=s.index('\nfunction ',start)
chunk=s[start:end];last=chunk.rfind('\n}')
chunk=chunk[:last]+"\n     await ensureIndexes(knex, 'acc_bank_statement_lines', [{ name: 'uq_acc_bank_matched_line', columns: ['matched_journal_line_id'], unique: true }]);\n"+chunk[last:];s=s[:start]+chunk+s[end:];p.write_text(s,encoding='utf-8')
# payment settled dates
p=Path('src/accountingModule/integrations/BillingAccounting.ts');s=p.read_text(encoding='utf-8');s=s.replace("documentRef: `PAY-${historyId}`,\n                    documentDate: bill?.billedon || new Date(),", "documentRef: `PAY-${historyId}`,\n                    documentDate: history?.Date || new Date(),");p.write_text(s,encoding='utf-8')
