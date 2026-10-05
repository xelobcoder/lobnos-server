import KnexConnection from '../../database/KnexConnections';
import { enqueuePosting } from '../services/AccountingOutboxService';
import { IBillingAccounting } from '../interfaces/IAccountingIntegrations';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { recordSubledgerEntry } from '../services/SubledgerService';
import logger from '../../hooks/logger';

const CASH = 'acc-1000';
const BANK = 'acc-1001';
const ACCOUNTS_RECEIVABLE = 'acc-1002';
const SERVICE_REVENUE = 'acc-4000';
const OUTPUT_VAT_PAYABLE = 'acc-2002';
const BAD_DEBT_EXPENSE = 'acc-5007';
const STAFF_BENEFIT_EXPENSE = 'acc-5010';

async function resolveDb(tenantId: number, trx?: any): Promise<any> {
     return trx || (await KnexConnection(tenantId));
}

async function resolvePaymentAccountCode(db: any, paymentModeId?: number | null): Promise<string> {
     if (!paymentModeId) return CASH;
     const paymentMode = await db('paymentmodes').select('PaymentMode').where({ KeyID: paymentModeId }).first();
     return paymentMode?.PaymentMode && /bank|transfer|cheque|check|card|momo|mobile|online|eft/i.test(paymentMode.PaymentMode)
          ? BANK
          : CASH;
}

export async function hasBillingReceivable(tenantId: number, billingId: number, trx?: any): Promise<boolean> {
     const db = await resolveDb(tenantId, trx);

     const queued = await db('acc_posting_outbox')
          .where({ source_module: SourceModule.BILLING, source_table: 'billing', source_pk: billingId })
          .whereIn('transaction_type', [TransactionType.ACCRUAL, TransactionType.ADJUSTMENT])
          .first();
     if (queued) return true;

     const posted = await db('acc_journal_entries')
          .where({ source_module: SourceModule.BILLING, source_table: 'billing', source_pk: billingId })
          .whereIn('transaction_type', [TransactionType.ACCRUAL, TransactionType.ADJUSTMENT])
          .first();

     return !!posted;
}

export async function enqueueBillingReceivable(
     tenantId: number,
     billingId: number,
     previousPayable: number,
     previousTax = 0,
     trx?: any
): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const bill = await db('billing')
               .select('billingid', 'payable', 'amountIncurredDueTax', 'branchid', 'billedon', 'lastupdatedby', 'patientid')
               .where({ billingid: billingId })
               .first();

          if (!bill) return;

          const grossDelta = round2(Number(bill.payable || 0) - Number(previousPayable || 0));
          const taxDelta = round2(Number(bill.amountIncurredDueTax || 0) - Number(previousTax || 0));
          const revenueDelta = round2(grossDelta - taxDelta);
          if (grossDelta === 0) return;

          const isInitial = Number(previousPayable || 0) === 0;
          const shared = {
               billingid: Number(bill.billingid),
               branchid: bill.branchid ? Number(bill.branchid) : null,
               employeeid: bill.lastupdatedby ? Number(bill.lastupdatedby) : null,
          };

          const receivableDirection = grossDelta > 0 ? NormalBalance.DEBIT : NormalBalance.CREDIT;
          const contraDirection = grossDelta > 0 ? NormalBalance.CREDIT : NormalBalance.DEBIT;

          const lines = [
               { accountCode: ACCOUNTS_RECEIVABLE, direction: receivableDirection, amount: Math.abs(grossDelta), ...shared },
               ...(revenueDelta !== 0
                    ? [{ accountCode: SERVICE_REVENUE, direction: contraDirection, amount: Math.abs(revenueDelta), ...shared }]
                    : []),
               ...(taxDelta !== 0
                    ? [{ accountCode: OUTPUT_VAT_PAYABLE, direction: contraDirection, amount: Math.abs(taxDelta), ...shared }]
                    : []),
          ];

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: isInitial ? TransactionType.ACCRUAL : TransactionType.ADJUSTMENT,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'billing',
                    sourcePk: Number(bill.billingid),
                    sourceRef: isInitial ? '' : String(round2(Number(bill.payable || 0))),
                    description: isInitial ? 'Bill issued' : 'Bill adjusted',
                    occurredAt: bill.billedon || new Date(),
                    createdBy: bill.lastupdatedby ? Number(bill.lastupdatedby) : null,
                    lines,
               },
               db
          );

          await recordSubledgerEntry(tenantId, db, {
               ledger: 'AR',
               partyType: 'patient',
               partyId: bill.patientid ? Number(bill.patientid) : null,
               documentType: isInitial ? 'invoice' : 'adjustment',
               documentRef: `BILL-${bill.billingid}`,
               documentDate: bill.billedon || new Date(),
               amount: grossDelta,
               grossAmount: grossDelta,
               taxAmount: taxDelta,
               sourceModule: SourceModule.BILLING,
               sourceTable: 'billing',
               sourceRef: `${bill.billingid}:${isInitial ? 'initial' : round2(Number(bill.payable || 0))}`,
               branchid: bill.branchid ? Number(bill.branchid) : null,
          });
     } catch (error: any) {
          logger.warn('Failed to enqueue billing receivable posting', {
               tenantId,
               billingId,
               error: error?.message || String(error),
          });
          if (trx) throw error;
     }
}

export async function enqueueBillingPayment(
     tenantId: number,
     historyId: number,
     billingId: number,
     paid: number,
     employeeId?: number | null,
     trx?: any
): Promise<void> {
     try {
          if (!historyId || Number(paid) <= 0) return;

          const db = await resolveDb(tenantId, trx);
          const [bill, history] = await Promise.all([
               db('billing')
                    .select('branchid', 'billedon', 'patientid')
                    .where({ billingid: billingId })
                    .first(),
               db('billinghx').select('Date', 'paymentmode').where({ KeyID: historyId }).first(),
          ]);

          const onReceivableBasis = await hasBillingReceivable(tenantId, billingId, db);
          const creditAccount = onReceivableBasis ? ACCOUNTS_RECEIVABLE : SERVICE_REVENUE;
          const cashAccount = await resolvePaymentAccountCode(db, history?.paymentmode);

          const shared = {
               amount: Number(paid),
               billingid: Number(billingId),
               employeeid: employeeId ? Number(employeeId) : null,
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.PAYMENT,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'billinghx',
                    sourcePk: Number(historyId),
                    description: 'Bill payment received',
                    occurredAt: history?.Date || new Date(),
                    createdBy: employeeId ? Number(employeeId) : null,
                    lines: [
                         { accountCode: cashAccount, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: creditAccount, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );

          if (onReceivableBasis) {
               await recordSubledgerEntry(tenantId, db, {
                    ledger: 'AR',
                    partyType: 'patient',
                    partyId: bill?.patientid ? Number(bill.patientid) : null,
                    documentType: 'payment',
                    documentRef: `PAY-${historyId}`,
                    documentDate: bill?.billedon || new Date(),
                    amount: -Number(paid),
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'billinghx',
                    sourceRef: String(historyId),
                    branchid: bill?.branchid ? Number(bill.branchid) : null,
               });
          }
     } catch (error: any) {
          logger.warn('Failed to enqueue billing payment posting', {
               tenantId,
               billingId,
               historyId,
               error: error?.message || String(error),
          });
          if (trx) throw error;
     }
}

export async function enqueueBillingWriteOff(
     tenantId: number,
     billingId: number,
     amount: number,
     employeeId?: number | null,
     trx?: any
): Promise<void> {
     try {
          const written = round2(Number(amount));
          if (!isFinite(written) || written <= 0) return;

          const db = await resolveDb(tenantId, trx);
          const bill = await db('billing')
               .select('branchid', 'patientid')
               .where({ billingid: billingId })
               .first();

          const shared = {
               amount: written,
               billingid: Number(billingId),
               employeeid: employeeId ? Number(employeeId) : null,
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.ADJUSTMENT,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'billing_writeoff',
                    sourcePk: Number(billingId),
                    description: 'Outstanding balance written off',
                    occurredAt: new Date(),
                    createdBy: employeeId ? Number(employeeId) : null,
                    lines: [
                         { accountCode: BAD_DEBT_EXPENSE, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: ACCOUNTS_RECEIVABLE, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );

          await recordSubledgerEntry(tenantId, db, {
               ledger: 'AR',
               partyType: 'patient',
               partyId: bill?.patientid ? Number(bill.patientid) : null,
               documentType: 'write_off',
               documentRef: `WO-${billingId}`,
               documentDate: new Date(),
               amount: -written,
               sourceModule: SourceModule.BILLING,
               sourceTable: 'billing_writeoff',
               sourceRef: String(billingId),
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          });
     } catch (error: any) {
          logger.warn('Failed to enqueue billing write-off posting', {
               tenantId,
               billingId,
               error: error?.message || String(error),
          });
          if (trx) throw error;
     }
}

export async function enqueueStaffFocBenefit(
     tenantId: number,
     focTransactionId: number,
     trx?: any
): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const foc = await db('staff_foc_transaction').where({ id: focTransactionId }).first();
          if (!foc || foc.status !== 'approved') return;

          const amount = round2(Number(foc.foc_amount || 0));
          if (!Number.isFinite(amount) || amount <= 0) return;

          const bill = await db('billing')
               .select('branchid', 'patientid')
               .where({ billingid: foc.billingid })
               .first();
          const staff = await db('roles').select('username').where({ employeeid: foc.employeeid }).first();
          const shared = {
               amount,
               billingid: Number(foc.billingid),
               employeeid: Number(foc.employeeid),
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          };
          const staffName = staff?.username || `employee ${foc.employeeid}`;

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.ADJUSTMENT,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'staff_foc_transaction',
                    sourcePk: Number(foc.id),
                    sourceRef: String(foc.id),
                    description: `Staff FOC benefit for ${staffName}`,
                    occurredAt: foc.approved_on || foc.created_at || new Date(),
                    createdBy: foc.approved_by ? Number(foc.approved_by) : Number(foc.requested_by),
                    lines: [
                         { accountCode: STAFF_BENEFIT_EXPENSE, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: ACCOUNTS_RECEIVABLE, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );

          await recordSubledgerEntry(tenantId, db, {
               ledger: 'AR',
               partyType: 'patient',
               partyId: bill?.patientid ? Number(bill.patientid) : Number(foc.patientid),
               documentType: 'staff_foc',
               documentRef: `FOC-${foc.id}`,
               documentDate: foc.approved_on || foc.created_at || new Date(),
               amount: -amount,
               sourceModule: SourceModule.BILLING,
               sourceTable: 'staff_foc_transaction',
               sourceRef: String(foc.id),
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          });
     } catch (error: any) {
          logger.warn('Failed to enqueue Staff FOC accounting posting', {
               tenantId,
               focTransactionId,
               error: error?.message || String(error),
          });
          if (trx) throw error;
     }
}

export async function enqueueStaffFocBenefitReversal(
     tenantId: number,
     focTransactionId: number,
     reversalReason: string,
     trx?: any
): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const foc = await db('staff_foc_transaction').where({ id: focTransactionId }).first();
          if (!foc || foc.status !== 'reversed') return;

          const amount = round2(Number(foc.foc_amount || 0));
          if (!Number.isFinite(amount) || amount <= 0) return;

          const bill = await db('billing')
               .select('branchid', 'patientid')
               .where({ billingid: foc.billingid })
               .first();
          const shared = {
               amount,
               billingid: Number(foc.billingid),
               employeeid: Number(foc.employeeid),
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.REVERSAL,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'staff_foc_transaction',
                    sourcePk: Number(foc.id),
                    sourceRef: `reversal:${foc.id}`,
                    description: `Reversed Staff FOC benefit: ${reversalReason}`,
                    occurredAt: foc.reversed_at || new Date(),
                    createdBy: foc.reversed_by ? Number(foc.reversed_by) : null,
                    lines: [
                         { accountCode: ACCOUNTS_RECEIVABLE, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: STAFF_BENEFIT_EXPENSE, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );

          await recordSubledgerEntry(tenantId, db, {
               ledger: 'AR',
               partyType: 'patient',
               partyId: bill?.patientid ? Number(bill.patientid) : Number(foc.patientid),
               documentType: 'staff_foc_reversal',
               documentRef: `FOC-REVERSAL-${foc.id}`,
               documentDate: foc.reversed_at || new Date(),
               amount,
               sourceModule: SourceModule.BILLING,
               sourceTable: 'staff_foc_transaction',
               sourceRef: `reversal:${foc.id}`,
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          });
     } catch (error: any) {
          logger.warn('Failed to enqueue Staff FOC reversal posting', {
               tenantId,
               focTransactionId,
               error: error?.message || String(error),
          });
          if (trx) throw error;
     }
}

export async function enqueueBillingRefund(
     tenantId: number,
     billingId: number,
     payableVoided: number,
     cashRefunded: number,
     employeeId?: number | null,
     trx?: any,
     refundHistoryId?: number,
     paymentModeId?: number
): Promise<void> {
     try {
          const voided = round2(Number(payableVoided) || 0);
          const refunded = round2(Number(cashRefunded) || 0);
          if (voided <= 0 && refunded <= 0) return;

          const db = await resolveDb(tenantId, trx);
          const bill = await db('billing').select('branchid', 'patientid').where({ billingid: billingId }).first();
          const refundHistory = refundHistoryId
               ? await db('billinghx').select('Date', 'paymentmode').where({ KeyID: refundHistoryId }).first()
               : null;
          const onReceivableBasis = await hasBillingReceivable(tenantId, billingId, db);
          const cashAccount = await resolvePaymentAccountCode(db, paymentModeId || refundHistory?.paymentmode);

          const dimensions = {
               billingid: Number(billingId),
               employeeid: employeeId ? Number(employeeId) : null,
               branchid: bill?.branchid ? Number(bill.branchid) : null,
          };

          const lines = onReceivableBasis
               ? [
                    ...(voided > 0
                         ? [
                              { accountCode: SERVICE_REVENUE, direction: NormalBalance.DEBIT, amount: voided, ...dimensions },
                              { accountCode: ACCOUNTS_RECEIVABLE, direction: NormalBalance.CREDIT, amount: voided, ...dimensions },
                         ]
                         : []),
                    ...(refunded > 0
                         ? [
                              { accountCode: ACCOUNTS_RECEIVABLE, direction: NormalBalance.DEBIT, amount: refunded, ...dimensions },
                              { accountCode: cashAccount, direction: NormalBalance.CREDIT, amount: refunded, ...dimensions },
                         ]
                         : []),
               ]
               : refunded > 0
                    ? [
                         { accountCode: SERVICE_REVENUE, direction: NormalBalance.DEBIT, amount: refunded, ...dimensions },
                         { accountCode: cashAccount, direction: NormalBalance.CREDIT, amount: refunded, ...dimensions },
                    ]
                    : [];

          if (lines.length === 0) return;

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.REFUND,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: refundHistoryId ? 'billinghx' : 'billing_void',
                    sourcePk: refundHistoryId ? Number(refundHistoryId) : Number(billingId),
                    sourceRef: refundHistoryId ? String(refundHistoryId) : '',
                    description: refundHistoryId ? 'Billing service refund paid' : 'Bill voided and refunded',
                    occurredAt: refundHistory?.Date || new Date(),
                    createdBy: employeeId ? Number(employeeId) : null,
                    lines,
               },
               db
          );

          if (onReceivableBasis && voided > 0) {
               await recordSubledgerEntry(tenantId, db, {
                    ledger: 'AR',
                    partyType: 'patient',
                    partyId: bill?.patientid ? Number(bill.patientid) : null,
                    documentType: 'credit_note',
                    documentRef: `CN-${billingId}`,
                    documentDate: new Date(),
                    amount: -voided,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: 'billing_void',
                    sourceRef: String(billingId),
                    branchid: bill?.branchid ? Number(bill.branchid) : null,
               });
          }

          if (onReceivableBasis && refunded > 0) {
               const refundSourceTable = refundHistoryId ? 'billinghx' : 'billing_void';
               const refundSourceRef = refundHistoryId ? String(refundHistoryId) : String(billingId);
               await recordSubledgerEntry(tenantId, db, {
                    ledger: 'AR',
                    partyType: 'patient',
                    partyId: bill?.patientid ? Number(bill.patientid) : null,
                    documentType: 'refund',
                    documentRef: `REFUND-${refundSourceRef}`,
                    documentDate: refundHistory?.Date || new Date(),
                    amount: refunded,
                    sourceModule: SourceModule.BILLING,
                    sourceTable: refundSourceTable,
                    sourceRef: refundSourceRef,
                    branchid: bill?.branchid ? Number(bill.branchid) : null,
               });
          }
     } catch (error: any) {
          logger.warn('Failed to enqueue billing refund posting', {
               tenantId,
               billingId,
               error: error?.message || String(error),
          });
          if (trx) throw error;
     }
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}

export const billingAccounting: IBillingAccounting = {
     hasBillingReceivable,
     enqueueBillingReceivable,
     enqueueBillingPayment,
     enqueueBillingWriteOff,
     enqueueBillingRefund,
};
