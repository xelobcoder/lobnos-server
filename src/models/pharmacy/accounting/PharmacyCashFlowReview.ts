import { PharmacyAccountingCore, accountingDate, fail, text } from './PharmacyAccountingCore';
import { cashFlowReview } from '../../../accountingModule/utils/cashFlow';
import { minorUnits, sumMinor } from '../../../accountingModule/utils/money';
import { assertPharmacyDayOpen } from '../PharmacyLedger';

/** Classification changes report evidence, never the immutable source journal or shared GL. */
export class PharmacyCashFlowReview extends PharmacyAccountingCore {
     async save(journalId: string, input: any) {
          return this.atomic(input, 'cash_flow:classify', async trx => {
               const journal = await trx('pharmacy_journals').where({ id: journalId, branchid: this.context.branch }).forUpdate().first();
               if (!journal) fail('Journal not found in this pharmacy branch', 'NOT_FOUND', 404);
               const reason = text(input.reason, 'classification evidence');
               const date = accountingDate(journal.financial_date);
               await this.postingAllowed(trx, date);
               await assertPharmacyDayOpen(trx, this.context.branch, date);
               const lines = await trx('pharmacy_journal_lines').where({ journal_id: journalId });
               const cash = lines.filter(row => row.account_code.startsWith('collection:'));
               if (!cash.length) fail('Journal has no cash movements');
               if (cash.length === lines.length || lines.reduce((sum, row) => sum + minorUnits(row.debit) - minorUnits(row.credit), 0) !== 0) {
                    fail('Only a balanced journal with external counterpart evidence can be classified');
               }
               for (const accountId of [...new Set(cash.map(row => Number(row.account_code.slice(11))))].sort((a, b) => a - b)) {
                    if (await trx('pharmacy_accounting_statements').where({ branchid: this.context.branch, account_id: accountId, status: 'finalized' }).where('end_date', '>=', date).forUpdate().first()) {
                         fail('Bank statement is finalized; its classification evidence is immutable', 'BANK_STATEMENT_FINALIZED', 409);
                    }
               }
               const net = cash.reduce((sum, row) => sum + minorUnits(row.debit) - minorUnits(row.credit), 0);
               const review = cashFlowReview(input, net, {
                    inflowMinor: sumMinor(cash.map(row => row.debit)),
                    outflowMinor: sumMinor(cash.map(row => row.credit)),
               });
               const before = await trx('pharmacy_cash_flow_classifications').where({ journal_id: journalId, branchid: this.context.branch }).first();
               const after = { journal_id: journalId, branchid: this.context.branch, operating: review.operating, investing: review.investing, financing: review.financing,
                    gross_allocations: JSON.stringify(review.allocations), updated_by: this.context.actor, updated_at: new Date() };
               await trx('pharmacy_cash_flow_classifications').insert(after).onConflict('journal_id').merge();
               await this.audit(trx, 'cash_flow:classify', journalId, before || null, { ...after, reason });
               return after;
          });
     }
}
