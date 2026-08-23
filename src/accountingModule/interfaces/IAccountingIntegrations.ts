export interface IExpenseAccounting {
     /**
      * Approval is the accrual point: the liability to the merchant exists once the expense is
      * approved, independently of when it is actually paid.
      * DR expense account / CR accounts payable.
      *
      * Expenses that merely mirror another module (supplier payment sync) are skipped, since that
      * module posts the liability and its settlement itself and would otherwise be double counted.
      * Never throws — a ledger failure must not roll back the approval.
      */
     enqueueExpenseAccrual(tenantId: number, expenseId: number, trx?: any): Promise<void>;

     /**
      * Undoes the accrual when a previously approved expense is rejected or moved back to pending.
      * DR accounts payable / CR expense account.
      *
      * Only one reversal per expense is recorded, because the idempotency key is
      * (module, table, pk, transaction_type, source_ref): repeated approve/reject cycles collapse.
      */
     enqueueExpenseAccrualReversal(tenantId: number, expenseId: number, trx?: any): Promise<void>;

     /** Settlement of an approved expense: DR accounts payable / CR cash or bank, chosen from the payment method. */
     enqueueExpensePayment(tenantId: number, paymentId: number, trx?: any): Promise<void>;

     /** Mirror of the payment entry: DR cash or bank / CR accounts payable. */
     enqueueExpensePaymentReversal(tenantId: number, paymentId: number, trx?: any): Promise<void>;
}

export interface ISupplierAccounting {
     /**
      * Settlement of a supplier liability created when goods were received.
      * DR accounts payable / CR cash or bank.
      *
      * `inv_supplier_payments.id` is a varchar, so the numeric source_pk stays 0 and the string id
      * is carried in sourceRef, which is part of the idempotency key.
      */
     enqueueSupplierPayment(tenantId: number, paymentId: string, trx?: any): Promise<void>;
}

export interface IInventoryAccounting {
     /**
      * Goods received against a purchase order create the supplier liability.
      * DR inventory / CR accounts payable. The matching supplier payment later clears the payable.
      */
     enqueueGoodsReceipt(
          tenantId: number,
          receipt: {
               id: string;
               unit_price: number;
               quantity_received: number;
               received_date?: Date | string;
               received_by?: number | null;
          },
          trx?: any
     ): Promise<void>;

     /**
      * Stock leaving the shelf is expensed at its recorded cost: consumption and transfers hit COGS,
      * wastage and adjustments hit the wastage account. Additions are skipped because purchase
      * receipts already debit inventory.
      */
     enqueueStockMovement(
          tenantId: number,
          movement: {
               id: string;
               transaction_type: string;
               total_cost?: number | null;
               transaction_date?: Date | string;
               performed_by?: number | null;
          },
          trx?: any
     ): Promise<void>;
}
