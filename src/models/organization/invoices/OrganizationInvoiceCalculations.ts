/**
 * Pure money/status/numbering rules for organizational credit invoices.
 *
 * All arithmetic is done in integer cents so totals, balances and allocations never drift through
 * floating point. Values coming from MySQL DECIMAL columns arrive as strings ("80.00") and are
 * converted once at the boundary with `toCents`.
 */

export type OrganizationInvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'void';

export const ORGANIZATION_INVOICE_STATUSES: readonly OrganizationInvoiceStatus[] = ['unpaid', 'partially_paid', 'paid', 'void'];

export class OrganizationInvoiceError extends Error {
     constructor(public readonly statusCode: number, message: string) {
          super(message);
          this.name = 'OrganizationInvoiceError';
     }
}

/** Converts a decimal amount (number or DECIMAL string) to integer cents. Rejects non-finite input. */
export function toCents(value: unknown): number {
     if (value === null || value === undefined || value === '') return 0;
     const numeric = typeof value === 'number' ? value : Number(String(value).trim());
     if (!Number.isFinite(numeric)) throw new OrganizationInvoiceError(400, 'Invalid monetary amount.');
     // toFixed(6) strips binary noise such as 0.1 + 0.2 before rounding to the cent.
     return Math.round(Number((numeric * 100).toFixed(6)));
}

export function fromCents(cents: number): number {
     return Number((cents / 100).toFixed(2));
}

/**
 * Parses a client-supplied payment amount. Must be a positive amount with at most two decimals;
 * we never silently round a payment the cashier typed.
 */
export function parsePaymentAmountCents(value: unknown): number {
     const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
     if (!/^\d+(\.\d{1,2})?$/.test(text)) {
          throw new OrganizationInvoiceError(400, 'Payment amount must be a positive number with at most two decimal places.');
     }
     const cents = toCents(text);
     if (cents <= 0) throw new OrganizationInvoiceError(400, 'Payment amount must be greater than zero.');
     return cents;
}

export function formatInvoiceNumber(year: number, sequence: number): string {
     if (!Number.isSafeInteger(year) || year < 2000 || year > 9999) throw new OrganizationInvoiceError(500, 'Invalid invoice year.');
     if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new OrganizationInvoiceError(500, 'Invalid invoice sequence.');
     return `INV-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Row shape read from `dboservices` (DECIMALs may be strings). */
export interface CreditServiceRow {
     serviceid: number;
     billingid: number;
     patientid: number | null;
     patient_name: string | null;
     service_name: string | null;
     service_date: Date | string | null;
     totalpayable: number | string | null;
     discount: number | string | null;
     amountIncurredDueTax: number | string | null;
     outstanding: number | string | null;
}

export interface InvoiceLineDraft {
     service_id: number;
     billing_id: number;
     patient_id: number | null;
     patient_name: string;
     description: string;
     service_date: Date | string | null;
     quantity: number;
     unit_price_cents: number;
     discount_cents: number;
     tax_cents: number;
     line_total_cents: number;
     prior_credit_cents: number;
     amount_due_cents: number;
}

/**
 * Builds an invoice line that always reconciles on paper:
 *   unit_price - discount + tax = line_total, and line_total - prior_credit = amount_due.
 * `totalpayable` already contains discount, tax and any night adjustment, so the unit price is
 * derived from it rather than from `cost` (which would not reconcile when adjustments applied).
 * `prior_credit` is whatever was already settled on the service (patient co-pay, write-off) before
 * the organization was invoiced; only the remaining `outstanding` is billed to the organization.
 */
export function buildInvoiceLine(row: CreditServiceRow): InvoiceLineDraft {
     const lineTotal = toCents(row.totalpayable);
     const outstanding = toCents(row.outstanding);
     let tax = Math.max(0, toCents(row.amountIncurredDueTax));
     let discount = Math.max(0, toCents(row.discount));

     if (lineTotal <= 0 || outstanding <= 0) {
          throw new OrganizationInvoiceError(409, `Service ${row.serviceid} has no outstanding amount to invoice.`);
     }
     if (outstanding > lineTotal) {
          throw new OrganizationInvoiceError(409, `Service ${row.serviceid} has an outstanding balance greater than its payable amount; correct the bill before invoicing.`);
     }
     if (tax > lineTotal) tax = 0;
     let unitPrice = lineTotal + discount - tax;
     if (unitPrice < 0) {
          discount = 0;
          unitPrice = lineTotal - tax;
     }

     return {
          service_id: Number(row.serviceid),
          billing_id: Number(row.billingid),
          patient_id: row.patientid ? Number(row.patientid) : null,
          patient_name: (row.patient_name || '').replace(/\s+/g, ' ').trim() || 'Unnamed patient',
          description: (row.service_name || '').trim() || `Service #${row.serviceid}`,
          service_date: row.service_date ?? null,
          quantity: 1,
          unit_price_cents: unitPrice,
          discount_cents: discount,
          tax_cents: tax,
          line_total_cents: lineTotal,
          prior_credit_cents: lineTotal - outstanding,
          amount_due_cents: outstanding,
     };
}

export interface InvoiceTotals {
     subtotal_cents: number;
     discount_cents: number;
     tax_cents: number;
     total_cents: number;
     prior_credit_cents: number;
     amount_due_cents: number;
}

export function computeInvoiceTotals(lines: InvoiceLineDraft[]): InvoiceTotals {
     const totals = lines.reduce<InvoiceTotals>((sum, line) => ({
          subtotal_cents: sum.subtotal_cents + line.unit_price_cents * line.quantity,
          discount_cents: sum.discount_cents + line.discount_cents,
          tax_cents: sum.tax_cents + line.tax_cents,
          total_cents: sum.total_cents + line.line_total_cents,
          prior_credit_cents: sum.prior_credit_cents + line.prior_credit_cents,
          amount_due_cents: sum.amount_due_cents + line.amount_due_cents,
     }), { subtotal_cents: 0, discount_cents: 0, tax_cents: 0, total_cents: 0, prior_credit_cents: 0, amount_due_cents: 0 });

     if (totals.subtotal_cents - totals.discount_cents + totals.tax_cents !== totals.total_cents) {
          throw new OrganizationInvoiceError(500, 'Invoice totals do not reconcile.');
     }
     if (totals.total_cents - totals.prior_credit_cents !== totals.amount_due_cents) {
          throw new OrganizationInvoiceError(500, 'Invoice amount due does not reconcile.');
     }
     return totals;
}

/**
 * Status is derived only from money actually received against the invoice — never from whether
 * the tests were completed.
 */
export function deriveInvoiceStatus(amountDueCents: number, amountPaidCents: number): Exclude<OrganizationInvoiceStatus, 'void'> {
     if (amountPaidCents < 0 || amountPaidCents > amountDueCents) {
          throw new OrganizationInvoiceError(500, 'Invoice paid amount is out of range.');
     }
     if (amountDueCents > 0 && amountPaidCents === amountDueCents) return 'paid';
     if (amountPaidCents > 0) return 'partially_paid';
     return 'unpaid';
}

export interface AllocatableLine {
     line_id: number;
     service_id: number;
     billing_id: number;
     /** amount_due - amount_paid on the invoice line */
     line_remaining_cents: number;
     /** current dboservices.outstanding (may have been reduced by another payment path) */
     service_outstanding_cents: number;
}

export interface Allocation {
     line_id: number;
     service_id: number;
     billing_id: number;
     amount_cents: number;
}

/**
 * Validates a payment against the invoice balance and allocates it oldest-line-first.
 * Rejects overpayment and any amount the underlying services can no longer absorb.
 */
export function allocatePayment(amountCents: number, balanceCents: number, lines: AllocatableLine[]): Allocation[] {
     if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
          throw new OrganizationInvoiceError(400, 'Payment amount must be greater than zero.');
     }
     if (balanceCents <= 0) throw new OrganizationInvoiceError(409, 'This invoice has no outstanding balance.');
     if (amountCents > balanceCents) {
          throw new OrganizationInvoiceError(400, `Payment of ${fromCents(amountCents).toFixed(2)} exceeds the invoice balance of ${fromCents(balanceCents).toFixed(2)}. Overpayments are not accepted.`);
     }

     let remaining = amountCents;
     const allocations: Allocation[] = [];
     for (const line of lines) {
          if (remaining === 0) break;
          const capacity = Math.min(Math.max(0, line.line_remaining_cents), Math.max(0, line.service_outstanding_cents));
          if (capacity <= 0) continue;
          const applied = Math.min(capacity, remaining);
          allocations.push({ line_id: line.line_id, service_id: line.service_id, billing_id: line.billing_id, amount_cents: applied });
          remaining -= applied;
     }

     if (remaining > 0) {
          const applicable = amountCents - remaining;
          throw new OrganizationInvoiceError(409, `Only ${fromCents(applicable).toFixed(2)} can be applied: some invoiced services were settled through another payment. Review the invoice before recording this payment.`);
     }
     return allocations;
}

/** Mirrors the per-service payment status rule used by multi-service payments. */
export function servicePaymentStatus(newOutstandingCents: number, newPaidCents: number): 'paid' | 'partial' | 'pending' {
     if (newOutstandingCents === 0) return 'paid';
     return newPaidCents > 0 ? 'partial' : 'pending';
}

export function defaultDueDate(invoiceDate: Date, days = 30): Date {
     const due = new Date(invoiceDate.getTime());
     due.setDate(due.getDate() + days);
     return due;
}
