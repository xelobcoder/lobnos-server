import KnexConnection from '../../database/KnexConnections';
import { enqueuePosting } from '../services/AccountingOutboxService';
import { IInventoryAccounting } from '../interfaces/IAccountingIntegrations';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import logger from '../../hooks/logger';

const INVENTORY = 'acc-1003';
const ACCOUNTS_PAYABLE = 'acc-2000';
const COST_OF_GOODS_SOLD = 'acc-5000';
const WASTAGE_EXPENSE = 'acc-5006';

export async function enqueueGoodsReceipt(
     tenantId: number,
     receipt: { id: string; unit_price: number; quantity_received: number; received_date?: Date | string; received_by?: number | null },
     trx?: any
): Promise<void> {
     try {
          const amount = Number(receipt.unit_price) * Number(receipt.quantity_received);
          if (!isFinite(amount) || amount <= 0) return;

          const db = trx || (await KnexConnection(tenantId));
          const shared = { amount: round2(amount) };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.ACCRUAL,
                    sourceModule: SourceModule.INVENTORY,
                    sourceTable: 'inv_purchase_order_receipts',
                    sourcePk: 0,
                    sourceRef: String(receipt.id),
                    description: 'Goods received into stock',
                    occurredAt: receipt.received_date || new Date(),
                    createdBy: receipt.received_by ? Number(receipt.received_by) : null,
                    lines: [
                         { accountCode: INVENTORY, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: ACCOUNTS_PAYABLE, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue goods receipt posting', {
               tenantId,
               receiptId: receipt?.id,
               error: error?.message || String(error),
          });
     }
}

export async function enqueueStockMovement(
     tenantId: number,
     movement: {
          id: string;
          transaction_type: string;
          total_cost?: number | null;
          transaction_date?: Date | string;
          performed_by?: number | null;
     },
     trx?: any
): Promise<void> {
     try {
          const amount = Number(movement.total_cost);
          if (!isFinite(amount) || amount <= 0) return;

          const expenseAccount = resolveOutflowAccount(movement.transaction_type);
          if (!expenseAccount) return;

          const db = trx || (await KnexConnection(tenantId));
          const shared = { amount: round2(amount) };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.ADJUSTMENT,
                    sourceModule: SourceModule.INVENTORY,
                    sourceTable: 'inv_inventory_transactions',
                    sourcePk: 0,
                    sourceRef: String(movement.id),
                    description: `Stock ${movement.transaction_type}`,
                    occurredAt: movement.transaction_date || new Date(),
                    createdBy: movement.performed_by ? Number(movement.performed_by) : null,
                    lines: [
                         { accountCode: expenseAccount, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: INVENTORY, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue stock movement posting', {
               tenantId,
               transactionId: movement?.id,
               error: error?.message || String(error),
          });
     }
}

function resolveOutflowAccount(transactionType: string): string | null {
     switch (transactionType) {
          case 'consumption':
          case 'transfer':
               return COST_OF_GOODS_SOLD;
          case 'wastage':
          case 'adjustment':
               return WASTAGE_EXPENSE;
          default:
               return null;
     }
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}

export const inventoryAccounting: IInventoryAccounting = {
     enqueueGoodsReceipt,
     enqueueStockMovement,
};
