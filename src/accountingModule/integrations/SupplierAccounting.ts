import KnexConnection from '../../database/KnexConnections';
import { enqueuePosting } from '../services/AccountingOutboxService';
import { ISupplierAccounting } from '../interfaces/IAccountingIntegrations';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import logger from '../../hooks/logger';

const ACCOUNTS_PAYABLE = 'acc-2000';
const CASH = 'acc-1000';
const BANK = 'acc-1001';

const CASH_METHODS = new Set(['cash']);

function resolveCashAccountCode(method?: string | null): string {
     return method && CASH_METHODS.has(String(method).toLowerCase()) ? CASH : BANK;
}

export async function enqueueSupplierPayment(tenantId: number, paymentId: string, trx?: any): Promise<void> {
     try {
          const db = trx || (await KnexConnection(tenantId));
          const payment = await db('inv_supplier_payments')
               .select('id', 'payment_amount', 'payment_method', 'payment_date', 'approved_by', 'payment_id')
               .where({ id: paymentId })
               .first();

          if (!payment || Number(payment.payment_amount) <= 0) return;

          const shared = { amount: Number(payment.payment_amount) };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.PAYMENT,
                    sourceModule: SourceModule.SUPPLIER,
                    sourceTable: 'inv_supplier_payments',
                    sourcePk: 0,
                    sourceRef: String(payment.id),
                    description: `Supplier payment ${payment.payment_id || payment.id}`,
                    occurredAt: payment.payment_date || new Date(),
                    createdBy: payment.approved_by ? Number(payment.approved_by) : null,
                    lines: [
                         { accountCode: ACCOUNTS_PAYABLE, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: resolveCashAccountCode(payment.payment_method), direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue supplier payment posting', {
               tenantId,
               paymentId,
               error: error?.message || String(error),
          });
     }
}

export const supplierAccounting: ISupplierAccounting = {
     enqueueSupplierPayment,
};
