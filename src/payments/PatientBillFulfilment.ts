import { Knex } from 'knex';
import KnexConnection from '../database/KnexConnections';
import MultiPayment from '../models/payments/multi-payment';
import { TenantGatewayStore } from './TenantGatewayStore';
import { BillQuote, FulfilmentOutcome, GatewayError, GatewayTransaction, IBillPaymentFulfilment } from './types';

const ONLINE_MODE = 'Online payment';
const toMinor = (value: unknown) => Math.round((parseFloat(String(value ?? 0)) || 0) * 100);

interface ServiceLine { serviceid: number; outstanding: unknown; }
type ApplyPayment = (tenantId: number, request: any) => Promise<{ success: boolean; message: string; alreadyApplied?: boolean }>;

/** Applies verified gateway money to a tenant bill through the same ledger path as a cashier payment. */
export class PatientBillFulfilment implements IBillPaymentFulfilment {
     constructor(
          private store: TenantGatewayStore,
          private getDb: (tenantId: number) => Promise<Knex> = tenantId => KnexConnection(tenantId) as Promise<Knex>,
          private apply: ApplyPayment = (tenantId, request) => new MultiPayment(tenantId).processPayment(request),
     ) { }

     private async loadBill(db: Knex, billingId: number) {
          const bill = await db('billing').where({ billingid: billingId }).first();
          if (!bill) throw new GatewayError('Bill not found', 404);
          if (bill.voidedat) throw new GatewayError('This bill has been voided', 409);
          const lines: ServiceLine[] = await db('dboservices').where({ billingid: billingId }).andWhere('outstanding', '>', 0).orderBy('serviceid', 'asc');
          const outstandingMinor = lines.reduce((sum, line) => sum + toMinor(line.outstanding), 0);
          return { bill, lines, outstandingMinor };
     }

     async quote(tenantId: number, billingId: number, requestedMinor?: number): Promise<BillQuote> {
          const db = await this.getDb(tenantId);
          const { outstandingMinor } = await this.loadBill(db, billingId);
          if (outstandingMinor <= 0) throw new GatewayError('This bill has no outstanding balance', 409);
          if (requestedMinor !== undefined) {
               if (!Number.isInteger(requestedMinor) || requestedMinor <= 0) throw new GatewayError('amount must be greater than zero');
               if (requestedMinor > outstandingMinor) throw new GatewayError('amount exceeds the outstanding balance');
          }
          return { amountMinor: requestedMinor ?? outstandingMinor, outstandingMinor, label: `Bill #${billingId}` };
     }

     private async onlineModeId(db: Knex): Promise<number> {
          const existing = await db('paymentmodes').whereRaw('LOWER(PaymentMode) = ?', [ONLINE_MODE.toLowerCase()]).first();
          if (existing) return Number(existing.KeyID);
          const [id] = await db('paymentmodes').insert({ PaymentMode: ONLINE_MODE });
          return Number(id);
     }

     async fulfil(tx: GatewayTransaction): Promise<FulfilmentOutcome> {
          const tenantId = tx.tenant_id;
          const billingId = tx.subject_id;
          if (!billingId) return { ok: false, reason: 'Transaction has no bill attached' };
          const db = await this.store.ensureSchema(tenantId);

          const done = await db('gateway_payment_applications').where({ reference: tx.reference }).first();
          if (done) return { ok: true, reference: `bill:${billingId}` };

          let bill;
          try { bill = await this.loadBill(db, billingId); }
          catch (error) { return { ok: false, reason: error instanceof GatewayError ? error.message : 'Bill could not be loaded' }; }
          if (tx.amount_minor > bill.outstandingMinor) {
               return { ok: false, reason: 'Amount paid exceeds the bill outstanding balance (possible overpayment or concurrent cashier payment)' };
          }

          const modeId = await this.onlineModeId(db);
          let remaining = tx.amount_minor;
          const service_payments = [];
          for (const line of bill.lines) {
               if (remaining <= 0) break;
               const take = Math.min(remaining, toMinor(line.outstanding));
               service_payments.push({ service_id: line.serviceid, amount: take / 100, discount: 0, waive_off: 0, payment_mode_id: modeId, billing_id: billingId });
               remaining -= take;
          }

          const result = await this.apply(tenantId, {
               service_payments, total_amount: tx.amount_minor / 100, total_discount: 0, total_waive_off: 0,
               description: `Online payment ${tx.reference} via ${tx.provider}`,
               employeeid: tx.initiated_by_employee_id, tenantId, idempotencyKey: tx.reference,
          });
          if (!result.success) return { ok: false, reason: result.message };
          return { ok: true, reference: `bill:${billingId}` };
     }
}
