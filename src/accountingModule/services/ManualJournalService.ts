import KnexConnection from '../../database/KnexConnections';
import { createAccountingService } from '../index';
import { AccountingError, AccountNotFoundError, EmptyTransactionError, UnbalancedTransactionError } from '../errors/AccountingErrors';
import { NormalBalance } from '../enums/normal-balance.enum';
import { parsePaging, parseSort } from '../utils/pagination';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import {
     CreateManualJournalInput,
     IManualJournal,
     IManualJournalLine,
     IManualJournalService,
     ManualJournalStatus,
} from '../interfaces/IManualJournalService';
import { FinancialFinalizationGuard } from './FinancialFinalizationGuard';

const BALANCE_TOLERANCE = 0.01;

export class ManualJournalService implements IManualJournalService {
     constructor(private tenantId: number) { }

     private async connection(trx?: any) {
          if (trx) return trx;
          return KnexConnection(this.tenantId);
     }

     async create(input: CreateManualJournalInput): Promise<IManualJournal> {
          const db = await this.connection();
          await this.validate(db, input);
          for (const branchId of [...new Set<number>(input.lines.map((line) => Number(line.branchid)).filter((value): value is number => Number.isInteger(value) && value > 0))]) await new FinancialFinalizationGuard(this.tenantId, db).assertDateOpen(branchId, input.journalDate);

          const journalNo = await this.nextJournalNumber(db, input.journalDate);

          const [id] = await db('acc_manual_journals').insert({
               journal_no: journalNo,
               journal_date: toDateOnly(input.journalDate),
               description: input.description,
               reference: input.reference || null,
               notes: input.notes || null,
               status: 'draft',
               created_by: input.createdBy ?? null,
               created_at: new Date(),
               updated_at: new Date(),
          });

          await this.replaceLines(db, id, input.lines);
          return db('acc_manual_journals').where({ id }).first();
     }

     async update(id: number, input: CreateManualJournalInput): Promise<IManualJournal> {
          const db = await this.connection();
          const journal = await this.requireStatus(db, id, ['draft']);
          await new FinancialFinalizationGuard(this.tenantId, db).assertRecordMutable('acc_manual_journals', id);
          await this.validate(db, input);
          for (const branchId of [...new Set<number>(input.lines.map((line) => Number(line.branchid)).filter((value): value is number => Number.isInteger(value) && value > 0))]) await new FinancialFinalizationGuard(this.tenantId, db).assertDateOpen(branchId, input.journalDate);

          await db('acc_manual_journals')
               .where({ id: journal.id })
               .update({
                    journal_date: toDateOnly(input.journalDate),
                    description: input.description,
                    reference: input.reference || null,
                    notes: input.notes || null,
                    updated_at: new Date(),
               });

          await this.replaceLines(db, journal.id, input.lines);
          return db('acc_manual_journals').where({ id: journal.id }).first();
     }

     async submit(id: number, employeeId: number): Promise<IManualJournal> {
          const db = await this.connection();
          const journal = await this.requireStatus(db, id, ['draft']);

          await db('acc_manual_journals').where({ id: journal.id }).update({
               status: 'submitted',
               submitted_by: employeeId,
               submitted_at: new Date(),
               updated_at: new Date(),
          });

          return db('acc_manual_journals').where({ id: journal.id }).first();
     }

     async approve(id: number, employeeId: number): Promise<IManualJournal> {
          const db = await this.connection();
          const journal = await this.requireStatus(db, id, ['submitted']);

          if (Number(journal.submitted_by) === Number(employeeId)) {
               throw new AccountingError(
                    'A manual journal must be approved by someone other than the person who submitted it',
                    'SEGREGATION_OF_DUTIES',
                    403
               );
          }

          await db('acc_manual_journals').where({ id: journal.id }).update({
               status: 'approved',
               approved_by: employeeId,
               approved_at: new Date(),
               updated_at: new Date(),
          });

          return db('acc_manual_journals').where({ id: journal.id }).first();
     }

     async post(id: number, employeeId: number): Promise<IManualJournal> {
          const db = await this.connection();
          const journal = await this.requireStatus(db, id, ['approved']);
          await new FinancialFinalizationGuard(this.tenantId, db).assertRecordMutable('acc_manual_journals', id);
          const lines = await db('acc_manual_journal_lines').where({ manual_journal_id: journal.id });
          for (const branchId of [...new Set<number>(lines.map((line: any) => Number(line.branchid)).filter((value: number): value is number => Number.isInteger(value) && value > 0))]) await new FinancialFinalizationGuard(this.tenantId, db).assertDateOpen(branchId, journal.journal_date);

          const { entry } = await createAccountingService(this.tenantId).postTransaction({
               tenantId: this.tenantId,
               transactionType: TransactionType.ADJUSTMENT,
               sourceModule: SourceModule.MANUAL,
               sourceTable: 'acc_manual_journals',
               sourcePk: Number(journal.id),
               description: journal.description,
               occurredAt: journal.journal_date,
               createdBy: employeeId,
               lines: lines.map(toPostingLine),
          });

          await db('acc_manual_journals').where({ id: journal.id }).update({
               status: 'posted',
               journal_entry_id: entry.id,
               posted_by: employeeId,
               posted_at: new Date(),
               updated_at: new Date(),
          });

          return db('acc_manual_journals').where({ id: journal.id }).first();
     }

     async reverse(id: number, employeeId: number, description?: string): Promise<IManualJournal> {
          const db = await this.connection();
          const journal = await this.requireStatus(db, id, ['posted']);
          await new FinancialFinalizationGuard(this.tenantId, db).assertRecordMutable('acc_manual_journals', id);

          if (!journal.journal_entry_id) {
               throw new AccountingError('Journal has no posted entry to reverse', 'NOT_POSTED', 409);
          }

          await createAccountingService(this.tenantId).reverse({
               tenantId: this.tenantId,
               journalEntryId: Number(journal.journal_entry_id),
               createdBy: employeeId,
               description: description || `Reversal of manual journal ${journal.journal_no}`,
          });

          const lines = await db('acc_manual_journal_lines').where({ manual_journal_id: journal.id });
          const reversal = await this.create({
               journalDate: new Date(),
               description: description || `Reversal of ${journal.journal_no}`,
               reference: journal.journal_no,
               createdBy: employeeId,
               lines: lines.map((line: any) => ({
                    account_code: line.account_code,
                    direction: line.direction === 'debit' ? 'credit' : 'debit',
                    amount: Number(line.amount),
                    branchid: line.branchid,
                    employeeid: line.employeeid,
                    line_description: line.line_description,
               })),
          });

          await db('acc_manual_journals').where({ id: reversal.id }).update({
               status: 'posted',
               posted_by: employeeId,
               posted_at: new Date(),
               approved_by: employeeId,
               approved_at: new Date(),
               updated_at: new Date(),
          });

          return db('acc_manual_journals').where({ id: reversal.id }).first();
     }

     async void(id: number, employeeId: number, reason?: string): Promise<IManualJournal> {
          const db = await this.connection();
          const journal = await this.requireStatus(db, id, ['draft', 'submitted', 'approved']);
          await new FinancialFinalizationGuard(this.tenantId, db).assertRecordMutable('acc_manual_journals', id);

          await db('acc_manual_journals').where({ id: journal.id }).update({
               status: 'void',
               notes: reason || journal.notes,
               updated_at: new Date(),
          });

          return db('acc_manual_journals').where({ id: journal.id }).first();
     }

     async findById(id: number): Promise<{ journal: IManualJournal; lines: IManualJournalLine[] } | null> {
          const db = await this.connection();
          const journal = await db('acc_manual_journals').where({ id }).first();
          if (!journal) return null;

          const lines = await db('acc_manual_journal_lines').where({ manual_journal_id: id }).orderBy('id', 'asc');
          return { journal, lines };
     }

     async list(filters: {
          status?: ManualJournalStatus;
          from?: string;
          to?: string;
          page?: number;
          count?: number;
          sortby?: string;
     }): Promise<{ data: IManualJournal[]; total: number; page: number; count: number }> {
          const db = await this.connection();
          const paging = parsePaging(filters, 25);
          const sort = parseSort(filters, ['id', 'journal_no', 'journal_date', 'status', 'description'], {
               column: 'id',
               direction: 'desc',
          });

          const base = db('acc_manual_journals');
          if (filters.status) base.where('status', filters.status);
          if (filters.from) base.where('journal_date', '>=', filters.from);
          if (filters.to) base.where('journal_date', '<=', filters.to);

          const totalRow = await base.clone().clearSelect().clearOrder().count('* as total').first();
          const data = await base.clone().orderBy(sort.column, sort.direction).limit(paging.count).offset(paging.offset);

          return { data, total: Number(totalRow?.total || 0), page: paging.page, count: paging.count };
     }

     private async validate(db: any, input: CreateManualJournalInput): Promise<void> {
          if (!input.lines || input.lines.length < 2) {
               throw new EmptyTransactionError();
          }

          const debits = round2(sumDirection(input.lines, 'debit'));
          const credits = round2(sumDirection(input.lines, 'credit'));
          if (Math.abs(debits - credits) > BALANCE_TOLERANCE) {
               throw new UnbalancedTransactionError(debits, credits);
          }

          for (const line of input.lines) {
               if (!(Number(line.amount) > 0)) {
                    throw new AccountingError('Every journal line needs a positive amount', 'INVALID_LINE_AMOUNT', 400);
               }
               const account = await db('acc_accounts').where({ account_code: line.account_code }).first();
               if (!account) throw new AccountNotFoundError(line.account_code);
          }
     }

     private async requireStatus(db: any, id: number, allowed: ManualJournalStatus[]): Promise<any> {
          const journal = await db('acc_manual_journals').where({ id }).first();
          if (!journal) throw new AccountingError(`Manual journal ${id} not found`, 'MANUAL_JOURNAL_NOT_FOUND', 404);
          if (!allowed.includes(journal.status)) {
               throw new AccountingError(
                    `Manual journal ${journal.journal_no} is ${journal.status}; expected ${allowed.join(' or ')}`,
                    'INVALID_JOURNAL_STATE',
                    409
               );
          }
          return journal;
     }

     private async replaceLines(db: any, manualJournalId: number, lines: IManualJournalLine[]): Promise<void> {
          await db('acc_manual_journal_lines').where({ manual_journal_id: manualJournalId }).del();
          await db('acc_manual_journal_lines').insert(
               lines.map((line) => ({
                    manual_journal_id: manualJournalId,
                    account_code: line.account_code,
                    direction: line.direction,
                    amount: Number(line.amount),
                    branchid: line.branchid ?? null,
                    employeeid: line.employeeid ?? null,
                    line_description: line.line_description ?? null,
                    created_at: new Date(),
               }))
          );
     }

     private async nextJournalNumber(db: any, journalDate: Date | string): Promise<string> {
          const year = new Date(journalDate).getFullYear();
          const prefix = `JV-${year}-`;

          const last = await db('acc_manual_journals')
               .where('journal_no', 'like', `${prefix}%`)
               .orderBy('journal_no', 'desc')
               .first();

          const lastSequence = last ? Number(String(last.journal_no).split('-')[2]) : 0;
          return `${prefix}${String(lastSequence + 1).padStart(5, '0')}`;
     }
}

function toPostingLine(line: any) {
     return {
          accountCode: line.account_code,
          direction: line.direction === 'debit' ? NormalBalance.DEBIT : NormalBalance.CREDIT,
          amount: Number(line.amount),
          branchid: line.branchid ?? null,
          employeeid: line.employeeid ?? null,
     };
}

function sumDirection(lines: IManualJournalLine[], direction: 'debit' | 'credit'): number {
     return lines
          .filter((line) => line.direction === direction)
          .reduce((total, line) => total + Number(line.amount), 0);
}

function toDateOnly(date: Date | string): string {
     return new Date(date).toISOString().split('T')[0];
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}
