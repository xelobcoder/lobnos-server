import { enqueuePosting } from '../../accountingModule/services/AccountingOutboxService';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';
import { NormalBalance } from '../../accountingModule/enums/normal-balance.enum';
import { SourceModule } from '../../accountingModule/enums/source-module.enum';
import { TransactionType } from '../../accountingModule/enums/transaction-type.enum';
import { PharmacySaleRow } from './interfaces/IPharmacySaleRepository';

export async function assertCollectionAccount(db: any, accountId: number, actorId: number, branch: number | null, method: string): Promise<any> {
     const account = await db('payment_accounts').where({ id: accountId, is_active: true }).forUpdate().first();
     const access = await db('payment_account_users').where({ payment_account_id: accountId, employeeid: actorId, can_pay: true, is_active: true }).first();
     if (!account || !access) throw new Error('You are not authorized to collect or refund through this account');
     if (account.branchid != null && Number(account.branchid) !== branch) throw new Error('Collection account is outside your branch');
     if (account.currency !== 'GHS') throw new Error('Pharmacy checkout currently requires a GHS account');
     const expected = method === 'card' ? 'bank' : method;
     if (account.account_type !== expected) throw new Error('Collection account does not match the payment method');
     if (!await db('acc_accounts').where({account_code:account.gl_account_code,is_active:true,type:'asset'}).first()) throw new Error('Collection account requires an active asset ledger account');
     return account;
}

export async function collectPharmacyPayment(db: any, tenantId: number, sale: PharmacySaleRow, verifiedBy?:number): Promise<void> {
     const account = await assertCollectionAccount(db, sale.paymentAccountId!, verifiedBy??sale.cashierId, sale.branchid ?? null, sale.paymentMethod);
     await new FinancialFinalizationGuard(tenantId, db).assertDateOpen(sale.branchid!, sale.completedAt!);
     await db('pharmacy_payments').insert({ sale_id: sale.id, payment_account_id: account.id, branchid: sale.branchid,
          amount: sale.totalAmount, method: sale.paymentMethod, reference: sale.paymentReference, status: 'collected', recorded_by: sale.cashierId, collected_at: sale.completedAt,verified_by:verifiedBy||null });
     await enqueuePosting(tenantId, { tenantId, sourceModule: SourceModule.INVENTORY, sourceTable: 'pharmacy_sales', sourcePk: 0,
          sourceRef: sale.id, transactionType: TransactionType.PAYMENT, occurredAt: sale.completedAt!, createdBy: sale.cashierId,
          description: `Pharmacy receipt ${sale.receiptNumber}`, lines: [
               { accountCode: account.gl_account_code, direction: NormalBalance.DEBIT, amount: sale.totalAmount, branchid: sale.branchid },
               { accountCode: 'acc-4001', direction: NormalBalance.CREDIT, amount: sale.totalAmount, branchid: sale.branchid },
               ...(sale.totalCost > 0 ? [
                    { accountCode: 'acc-5000', direction: NormalBalance.DEBIT, amount: sale.totalCost, branchid: sale.branchid },
                    { accountCode: 'acc-1003', direction: NormalBalance.CREDIT, amount: sale.totalCost, branchid: sale.branchid },
               ] : []),
          ] }, db);
}

export async function refundPharmacyPayment(db: any, tenantId: number, sale: PharmacySaleRow, actor: number, reason: string, restock: boolean): Promise<void> {
     const payment = await db('pharmacy_payments').where({ sale_id: sale.id }).forUpdate().first();
     if (!payment) throw new Error('This historical sale has no collection ledger entry. Reconcile its payment before reversing it');
     if (payment.status !== 'collected') throw new Error('This payment has already been reversed');
     const account = await assertCollectionAccount(db, Number(payment.payment_account_id), actor, sale.branchid ?? null, sale.paymentMethod);
     const guard = new FinancialFinalizationGuard(tenantId, db);
     await guard.assertRecordMutable('pharmacy_sales', sale.id);
     await guard.assertDateOpen(sale.branchid!, new Date());
     await db('pharmacy_payments').where({ id: payment.id }).update({ status: 'refunded', reversed_by: actor, reversed_at: new Date(), reversal_reason: reason });
     await enqueuePosting(tenantId, { tenantId, sourceModule: SourceModule.INVENTORY, sourceTable: 'pharmacy_sales', sourcePk: 0,
          sourceRef: sale.id, transactionType: TransactionType.REFUND, occurredAt: new Date(), createdBy: actor,
          description: `Pharmacy reversal ${sale.receiptNumber}: ${reason}`, lines: [
               { accountCode: 'acc-4001', direction: NormalBalance.DEBIT, amount: sale.totalAmount, branchid: sale.branchid },
               { accountCode: account.gl_account_code, direction: NormalBalance.CREDIT, amount: sale.totalAmount, branchid: sale.branchid },
               ...(restock && sale.totalCost > 0 ? [
                    { accountCode: 'acc-1003', direction: NormalBalance.DEBIT, amount: sale.totalCost, branchid: sale.branchid },
                    { accountCode: 'acc-5000', direction: NormalBalance.CREDIT, amount: sale.totalCost, branchid: sale.branchid },
               ] : []),
          ] }, db);
}
