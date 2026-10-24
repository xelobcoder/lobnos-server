import { PharmacySaleRow } from './interfaces/IPharmacySaleRepository';
import { assertPharmacyDayOpen, postPharmacyJournal, resolvePharmacyDestination } from './PharmacyLedger';

export async function collectPharmacyPayment(db: any, _tenantId: number, sale: PharmacySaleRow): Promise<void> {
     if (sale.accountingVersion !== 2) throw new Error('Historical collections require a reviewed legacy reconciliation');
     await assertPharmacyDayOpen(db, sale.branchid!, sale.completedAt!);
     const shift = await db('pharmacy_shifts').where({ active_key: `${sale.branchid}:${sale.cashierId}` }).forUpdate().first();
     if (!shift) throw new Error('Open your pharmacy shift before completing a sale');
     const shiftDate = shift.financial_date || shift.opened_at;
     if (shiftDate && (shiftDate instanceof Date ? shiftDate.toISOString().slice(0,10) : String(shiftDate).slice(0,10)) !== new Date(sale.completedAt!).toISOString().slice(0,10)) throw new Error('Close your previous financial day’s shift and open a shift for today before selling');
     const account = await resolvePharmacyDestination(db, sale.branchid!, sale.paymentMethod);
     sale.paymentAccountId = Number(account.id); sale.shiftId = shift.id;
     await db('pharmacy_sales').where({ id: sale.id }).update({ payment_account_id: account.id, shift_id: shift.id });
     await db('pharmacy_payments').insert({ sale_id: sale.id, payment_account_id: account.id, branchid: sale.branchid,
          amount: sale.totalAmount, method: sale.paymentMethod, reference: sale.paymentReference, status: 'collected', recorded_by: sale.cashierId, collected_at: sale.completedAt });
     await postPharmacyJournal(db, sale.branchid!, sale.id, 'sale', `Pharmacy receipt ${sale.receiptNumber}`, sale.cashierId, [
          { account: `collection:${account.id}`, debit: sale.totalAmount }, { account: 'sales', credit: sale.totalAmount },
          ...(sale.totalCost > 0 ? [{ account: 'cost_of_sales', debit: sale.totalCost }, { account: 'inventory', credit: sale.totalCost }] : []),
     ], sale.completedAt!);
}

export async function refundPharmacyPayment(db: any, _tenantId: number, sale: PharmacySaleRow, actor: number, reason: string, restock: boolean): Promise<void> {
     if (sale.accountingVersion !== 2) throw new Error('Legacy sale: reconcile its original books before making a historical correction');
     await assertPharmacyDayOpen(db, sale.branchid!);
     const payment = await db('pharmacy_payments').where({ sale_id: sale.id }).forUpdate().first();
     if (!payment) throw new Error('This sale has no collection entry');
     if (payment.status !== 'collected') throw new Error('This payment has already been reversed');
     const account = await db('pharmacy_collection_accounts').where({ id: payment.payment_account_id, branchid: sale.branchid, is_active: true }).forUpdate().first();
     if (!account) throw new Error('The original pharmacy refund destination is unavailable');
     const shift = await db('pharmacy_shifts').where({ active_key: `${sale.branchid}:${actor}` }).forUpdate().first();
     if (!shift) throw new Error('Open your pharmacy shift before issuing a refund');
     const shiftDate = shift.financial_date || shift.opened_at;
     if (shiftDate && (shiftDate instanceof Date ? shiftDate.toISOString().slice(0,10) : String(shiftDate).slice(0,10)) !== new Date().toISOString().slice(0,10)) throw new Error('Open a shift for today before issuing a refund');
     await db('pharmacy_payments').where({ id: payment.id }).update({ status: 'refunded', reversed_by: actor, reversed_at: new Date(), reversal_reason: reason, refund_shift_id: shift.id });
     await postPharmacyJournal(db, sale.branchid!, sale.id, 'refund', `Pharmacy reversal ${sale.receiptNumber}: ${reason}`, actor, [
          { account: 'sales', debit: sale.totalAmount }, { account: `collection:${account.id}`, credit: sale.totalAmount },
          ...(restock && sale.totalCost > 0 ? [{ account: 'inventory', debit: sale.totalCost }, { account: 'cost_of_sales', credit: sale.totalCost }] : []),
     ]);
}
