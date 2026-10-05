export interface IPayrollAccounting {
     /**
      * Approval is the accrual point: DR salaries expense at **gross**, credited out to PAYE
      * payable, other deductions payable and salaries payable at net.
      *
      * Payroll also mirrors itself into the expenses module at net pay only, which is why that
      * mirror is excluded from expense postings — it would both double count the expense and hide
      * the statutory liabilities owed to GRA and SSNIT.
      */
     enqueuePayrollAccrual(tenantId: number, periodId: number, employeeId?: number | null, trx?: any): Promise<void>;

     /**
      * Disbursement of net pay only: DR salaries payable / CR cash or bank. The tax and pension
      * liabilities stay on the balance sheet until they are separately remitted.
      */
     enqueuePayrollPayment(
          tenantId: number,
          periodId: number,
          paymentMethod: string,
          paymentDate: string | Date,
          employeeId?: number | null,
          trx?: any
     ): Promise<void>;
}

export interface IBillingAccounting {
     /**
      * True once a bill has an accrual or adjustment enqueued or posted. Bills issued before
      * receivables existed have none, which is how the payment posting stays correct for
      * historical data instead of crediting a receivable that was never debited.
      */
     hasBillingReceivable(tenantId: number, billingId: number, trx?: any): Promise<boolean>;

     /**
      * Revenue is recognised when the bill is issued, not when cash arrives:
      * DR accounts receivable / CR service revenue.
      *
      * Posts the delta between the previous and current `billing.payable`, so an addition or
      * correction adjustment books only the change. The first posting for a bill is an ACCRUAL;
      * later ones are ADJUSTMENTs keyed by the resulting total, so re-running a given total is a
      * no-op while a genuine further change still posts. A negative delta flips both directions.
      */
     enqueueBillingReceivable(tenantId: number, billingId: number, previousPayable: number, trx?: any): Promise<void>;

     /**
      * Cash receipt against a bill: DR cash / CR accounts receivable, falling back to CR service
      * revenue for bills that never had a receivable raised.
      */
     enqueueBillingPayment(
          tenantId: number,
          historyId: number,
          billingId: number,
          paid: number,
          employeeId?: number | null,
          trx?: any
     ): Promise<void>;

     /**
      * Writing off an uncollectable balance clears the receivable against bad debt expense:
      * DR bad debt expense / CR accounts receivable. No cash moves, which is why the write-off's
      * mirror expense record is excluded from the expense postings.
      */
     enqueueBillingWriteOff(
          tenantId: number,
          billingId: number,
          amount: number,
          employeeId?: number | null,
          trx?: any
     ): Promise<void>;

     /**
      * Voiding a bill and refunding the customer, posted as one balanced entry rather than by
      * deleting history: DR revenue / CR receivable cancels the billed amount, and
      * DR receivable / CR cash returns the money, which together leave the receivable at nil.
      *
      * Bills that predate receivables recognised revenue on cash receipt, so only the refunded
      * cash is reversed for them: DR revenue / CR cash.
      */
     enqueueBillingRefund(
          tenantId: number,
          billingId: number,
          payableVoided: number,
          cashRefunded: number,
          employeeId?: number | null,
          trx?: any,
          refundHistoryId?: number,
          paymentModeId?: number
     ): Promise<void>;
}

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
      * Undoes a receipt when the purchase order is cancelled after goods arrived:
      * DR accounts payable / CR inventory.
      */
     enqueueGoodsReceiptReversal(
          tenantId: number,
          receipt: {
               id: string;
               unit_price: number;
               quantity_received: number;
               received_by?: number | null;
          },
          trx?: any
     ): Promise<void>;

     /**
      * Stock leaving the shelf is expensed at its recorded cost: consumption hits COGS, wastage and
      * adjustments hit the wastage account. Additions are skipped because purchase receipts already
      * debit inventory, and transfers are skipped because the goods remain the company's asset —
      * they need inter-branch accounts, not an expense.
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
