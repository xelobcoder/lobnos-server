import { Knex } from 'knex';
import { AuthUser } from '../../../middleware/authority';
import { getAllCompanyProfiles } from '../../settings/companyProfile';
import { enqueueBillingPayment } from '../../../accountingModule/integrations/BillingAccounting';
import { applyDboservicesAfterUpdate } from '../../../database/appLevelTriggers';
import { bootstrapOrganizationInvoices } from './OrganizationInvoiceBootstrapper';
import { lockMutableBill } from '../../billing/BillingFinancialGuard';
import {
     AllocatableLine,
     CreditServiceRow,
     ORGANIZATION_INVOICE_STATUSES,
     OrganizationInvoiceError,
     OrganizationInvoiceStatus,
     allocatePayment,
     buildInvoiceLine,
     computeInvoiceTotals,
     defaultDueDate,
     deriveInvoiceStatus,
     formatInvoiceNumber,
     fromCents,
     parsePaymentAmountCents,
     servicePaymentStatus,
     toCents,
} from './OrganizationInvoiceCalculations';

export interface GenerateInvoiceInput {
     organizationId: unknown;
     billingIds: unknown;
     dueDate?: unknown;
     paymentTerms?: unknown;
     reference?: unknown;
     notes?: unknown;
}

export interface RecordPaymentInput {
     amount: unknown;
     paymentModeId: unknown;
     paymentDate?: unknown;
     reference?: unknown;
     notes?: unknown;
     idempotencyKey?: unknown;
}

export interface ListInvoicesInput {
     organizationId?: unknown;
     status?: unknown;
     search?: unknown;
     page?: unknown;
     count?: unknown;
}

const MAX_BILLS_PER_INVOICE = 200;
const DEFAULT_PAYMENT_TERMS = 'As agreed in contract';
/** Services in these states are not billable to the organization. */
const NON_BILLABLE_SERVICE_STATUSES = ['voided', 'void', 'written-off', 'refunded'];

function positiveInt(value: unknown, field: string): number {
     const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
     if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new OrganizationInvoiceError(400, `A valid ${field} is required.`);
     return parsed;
}

function optionalText(value: unknown, field: string, max: number): string {
     if (value === undefined || value === null) return '';
     if (typeof value !== 'string') throw new OrganizationInvoiceError(400, `${field} must be text.`);
     const trimmed = value.trim();
     if (trimmed.length > max) throw new OrganizationInvoiceError(400, `${field} must be at most ${max} characters.`);
     return trimmed;
}

/** Local calendar date as YYYY-MM-DD (DATE columns must not shift through UTC conversion). */
export function toDateOnly(date: Date): string {
     const pad = (n: number) => String(n).padStart(2, '0');
     return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateOnly(value: unknown, field: string): string | null {
     if (value === undefined || value === null || value === '') return null;
     if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new OrganizationInvoiceError(400, `${field} must be a date (YYYY-MM-DD).`);
     const [y, m, d] = value.split('-').map(Number);
     const date = new Date(y, m - 1, d);
     if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) throw new OrganizationInvoiceError(400, `${field} is not a valid date.`);
     return value;
}

function isDuplicateKey(error: any): boolean {
     return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
}

/**
 * Reserves the next invoice number for `year`. Must run inside the invoice transaction: the
 * sequence row is locked FOR UPDATE, so concurrent generators serialize and a rolled-back
 * invoice also rolls back its number (no gaps, no duplicates).
 */
export async function nextInvoiceNumber(trx: Knex.Transaction, year: number): Promise<string> {
     await trx.raw('INSERT IGNORE INTO org_invoice_sequences (`seq_year`, `last_value`) VALUES (?, 0)', [year]);
     const row = await trx('org_invoice_sequences').select('last_value').where({ seq_year: year }).forUpdate().first();
     if (!row) throw new OrganizationInvoiceError(500, 'Unable to reserve an invoice number.');
     const next = Number(row.last_value) + 1;
     await trx('org_invoice_sequences').where({ seq_year: year }).update({ last_value: next });
     return formatInvoiceNumber(year, next);
}

export class OrganizationInvoiceService {
     constructor(private readonly tenantId: number) { }

     private db(): Promise<Knex> {
          return bootstrapOrganizationInvoices(this.tenantId);
     }

     /** Uninvoiced, outstanding, non-void organizational credit services for one organization. */
     private creditServicesQuery(db: Knex | Knex.Transaction, organizationId: number) {
          return this.uninvoicedCreditServices(db).where('s.organizationId', organizationId);
     }

     private uninvoicedCreditServices(db: Knex | Knex.Transaction) {
          return db('dboservices as s')
               .join('billing as b', 'b.billingid', 's.billingid')
               .leftJoin('new_patients as np', 'np.patientid', 'b.patientid')
               .select(
                    's.serviceid', 's.billingid', 'b.patientid', 'b.billedon',
                    's.totalpayable', 's.discount', 's.amountIncurredDueTax', 's.outstanding', 's.paidamount',
                    db.raw('COALESCE(s.serviceAddedOn, b.billedon) AS service_date'),
                    db.raw("TRIM(CONCAT_WS(' ', np.firstname, np.middlename, np.lastname)) AS patient_name"),
                    db.raw(`CASE WHEN s.categoryTrackId = 5
                         THEN (SELECT serviceName FROM additionalservices WHERE keyid = s.trackId)
                         ELSE (SELECT name FROM test_panels WHERE id = s.trackId) END AS service_name`),
               )
               .whereNotNull('s.organizationId')
               .where('s.outstanding', '>', 0)
               .whereNull('s.voidedat')
               .whereNull('b.voidedat')
               .whereRaw('COALESCE(s.isRefunded, 0) = 0')
               .where(q => q.whereNull('s.status').orWhereNotIn('s.status', NON_BILLABLE_SERVICE_STATUSES))
               .where(q => q.whereNull('b.status').orWhereNot('b.status', 'voided'))
               .whereNotExists(function () {
                    this.select(db.raw('1')).from('org_invoice_lines as l').whereRaw('l.active_service_id = s.serviceid');
               });
     }

     private async requireOrganization(db: Knex | Knex.Transaction, organizationId: number) {
          const org = await db('organization').select('*').where({ id: organizationId }).first();
          if (!org) throw new OrganizationInvoiceError(404, 'Organization not found.');
          return org;
     }

     /** Organizations with their uninvoiced credit and open invoice balance, for the invoicing screen. */
     async getOrganizationsSummary() {
          const db = await this.db();
          const [organizations, uninvoiced, open] = await Promise.all([
               db('organization').select('id', 'name').orderBy('name').limit(2000),
               this.uninvoicedCreditServices(db).clearSelect()
                    .select('s.organizationId as organization_id')
                    .sum({ amount: 's.outstanding' })
                    .count({ services: 's.serviceid' })
                    .groupBy('s.organizationId'),
               db('org_invoices').whereNot('status', 'void').select('organization_id').sum({ balance: 'balance_due' }).groupBy('organization_id'),
          ]);
          const uninvoicedByOrg = new Map<number, any>(uninvoiced.map((r: any) => [Number(r.organization_id), r]));
          const openByOrg = new Map<number, any>(open.map((r: any) => [Number(r.organization_id), r]));
          return organizations.map((org: any) => ({
               id: Number(org.id),
               name: org.name || `Organization #${org.id}`,
               uninvoiced_amount: fromCents(toCents(uninvoicedByOrg.get(Number(org.id))?.amount)),
               uninvoiced_services: Number(uninvoicedByOrg.get(Number(org.id))?.services || 0),
               open_balance: fromCents(toCents(openByOrg.get(Number(org.id))?.balance)),
          }));
     }

     async getEligibleBills(organizationIdRaw: unknown) {
          const organizationId = positiveInt(organizationIdRaw, 'organizationId');
          const db = await this.db();
          await this.requireOrganization(db, organizationId);
          const rows = await this.creditServicesQuery(db, organizationId)
               .orderBy([{ column: 'b.billedon', order: 'asc' }, { column: 's.serviceid', order: 'asc' }])
               .limit(2000);

          const bills = new Map<number, any>();
          for (const row of rows) {
               const billingid = Number(row.billingid);
               let bill = bills.get(billingid);
               if (!bill) {
                    bill = { billingid, billedon: row.billedon, patient_name: row.patient_name || '', outstanding_cents: 0, services: [] as any[] };
                    bills.set(billingid, bill);
               }
               bill.outstanding_cents += toCents(row.outstanding);
               bill.services.push({
                    serviceid: Number(row.serviceid),
                    service_name: row.service_name || `Service #${row.serviceid}`,
                    totalpayable: fromCents(toCents(row.totalpayable)),
                    outstanding: fromCents(toCents(row.outstanding)),
               });
          }
          return [...bills.values()].map(({ outstanding_cents, ...bill }) => ({ ...bill, outstanding: fromCents(outstanding_cents) }));
     }

     async generateInvoice(actor: AuthUser, input: GenerateInvoiceInput) {
          const organizationId = positiveInt(input.organizationId, 'organizationId');
          if (!Array.isArray(input.billingIds) || input.billingIds.length === 0) {
               throw new OrganizationInvoiceError(400, 'Select at least one organizational credit bill to invoice.');
          }
          const billingIds = [...new Set(input.billingIds.map(id => positiveInt(id, 'billing id')))];
          if (billingIds.length > MAX_BILLS_PER_INVOICE) {
               throw new OrganizationInvoiceError(400, `An invoice may include at most ${MAX_BILLS_PER_INVOICE} bills.`);
          }
          const invoiceDate = new Date();
          const invoiceDateOnly = toDateOnly(invoiceDate);
          const dueDate = parseDateOnly(input.dueDate, 'Due date') || toDateOnly(defaultDueDate(invoiceDate));
          if (dueDate < invoiceDateOnly) throw new OrganizationInvoiceError(400, 'Due date cannot be before the invoice date.');
          const paymentTerms = optionalText(input.paymentTerms, 'Payment terms', 255) || DEFAULT_PAYMENT_TERMS;
          const reference = optionalText(input.reference, 'Reference', 120);
          const notes = optionalText(input.notes, 'Notes', 1000);

          const db = await this.db();
          try {
               const invoiceId = await db.transaction(async trx => {
                    await this.requireOrganization(trx, organizationId);

                    // Lock the candidate services so a concurrent generator or payment waits for us.
                    const rows: CreditServiceRow[] = await this.creditServicesQuery(trx, organizationId)
                         .whereIn('s.billingid', billingIds)
                         .orderBy([{ column: 'b.billedon', order: 'asc' }, { column: 's.billingid', order: 'asc' }, { column: 's.serviceid', order: 'asc' }])
                         .forUpdate();

                    const covered = new Set(rows.map(row => Number(row.billingid)));
                    const missing = billingIds.filter(id => !covered.has(id));
                    if (missing.length > 0) {
                         throw new OrganizationInvoiceError(409, `Bill(s) ${missing.join(', ')} have no uninvoiced outstanding charges for this organization (already invoiced, settled, voided, or billed to another payer).`);
                    }

                    const lines = rows.map(buildInvoiceLine);
                    const totals = computeInvoiceTotals(lines);
                    if (totals.amount_due_cents <= 0) throw new OrganizationInvoiceError(409, 'There is no outstanding amount to invoice.');

                    const invoiceNumber = await nextInvoiceNumber(trx, invoiceDate.getFullYear());
                    const [id] = await trx('org_invoices').insert({
                         invoice_number: invoiceNumber,
                         organization_id: organizationId,
                         invoice_date: invoiceDateOnly,
                         due_date: dueDate,
                         status: 'unpaid',
                         payment_terms: paymentTerms,
                         reference,
                         notes,
                         subtotal: fromCents(totals.subtotal_cents),
                         discount_total: fromCents(totals.discount_cents),
                         tax_total: fromCents(totals.tax_cents),
                         total_amount: fromCents(totals.total_cents),
                         prior_credits: fromCents(totals.prior_credit_cents),
                         amount_due: fromCents(totals.amount_due_cents),
                         amount_paid: 0,
                         balance_due: fromCents(totals.amount_due_cents),
                         created_by: actor.employeeid,
                    });
                    const newInvoiceId = Number(id);
                    if (!newInvoiceId) throw new OrganizationInvoiceError(500, 'Unable to create the invoice.');

                    await trx('org_invoice_lines').insert(lines.map(line => ({
                         invoice_id: newInvoiceId,
                         service_id: line.service_id,
                         active_service_id: line.service_id,
                         billing_id: line.billing_id,
                         patient_id: line.patient_id,
                         patient_name: line.patient_name.slice(0, 255),
                         description: line.description.slice(0, 255),
                         service_date: line.service_date ? new Date(line.service_date) : null,
                         quantity: line.quantity,
                         unit_price: fromCents(line.unit_price_cents),
                         discount: fromCents(line.discount_cents),
                         tax: fromCents(line.tax_cents),
                         line_total: fromCents(line.line_total_cents),
                         prior_credit: fromCents(line.prior_credit_cents),
                         amount_due: fromCents(line.amount_due_cents),
                         amount_paid: 0,
                    })));
                    return newInvoiceId;
               });
               return this.getInvoice(invoiceId);
          } catch (error) {
               if (isDuplicateKey(error)) throw new OrganizationInvoiceError(409, 'One or more of these services was invoiced by another user just now. Refresh and try again.');
               throw error;
          }
     }

     async listInvoices(input: ListInvoicesInput) {
          const page = input.page === undefined ? 1 : positiveInt(input.page, 'page');
          const count = input.count === undefined ? 25 : positiveInt(input.count, 'count');
          if (count > 100) throw new OrganizationInvoiceError(400, 'count must be at most 100.');
          const organizationId = input.organizationId === undefined || input.organizationId === '' ? null : positiveInt(input.organizationId, 'organizationId');
          const status = input.status === undefined || input.status === '' ? null : String(input.status);
          if (status && !ORGANIZATION_INVOICE_STATUSES.includes(status as OrganizationInvoiceStatus)) {
               throw new OrganizationInvoiceError(400, `status must be one of ${ORGANIZATION_INVOICE_STATUSES.join(', ')}.`);
          }
          const search = optionalText(input.search, 'search', 100);

          const db = await this.db();
          const base = db('org_invoices as i').leftJoin('organization as o', 'o.id', 'i.organization_id');
          if (organizationId) base.where('i.organization_id', organizationId);
          if (status) base.where('i.status', status);
          if (search) {
               const like = `%${search.replace(/[\\%_]/g, m => `\\${m}`)}%`;
               base.where(q => q.where('i.invoice_number', 'like', like).orWhere('o.name', 'like', like).orWhere('i.reference', 'like', like));
          }

          const [countRow, summaryRow, rows] = await Promise.all([
               base.clone().count({ total: 'i.id' }).first(),
               base.clone().whereNot('i.status', 'void')
                    .sum({ amount_due: 'i.amount_due', amount_paid: 'i.amount_paid', balance_due: 'i.balance_due' }).first(),
               base.clone()
                    .select('i.id', 'i.invoice_number', 'i.organization_id', 'o.name as organization_name', 'i.invoice_date', 'i.due_date',
                         'i.status', 'i.total_amount', 'i.amount_due', 'i.amount_paid', 'i.balance_due', 'i.reference', 'i.created_at')
                    .orderBy('i.id', 'desc')
                    .limit(count)
                    .offset((page - 1) * count),
          ]);

          return {
               rows,
               total: Number((countRow as any)?.total || 0),
               page,
               count,
               summary: {
                    amount_due: fromCents(toCents((summaryRow as any)?.amount_due)),
                    amount_paid: fromCents(toCents((summaryRow as any)?.amount_paid)),
                    balance_due: fromCents(toCents((summaryRow as any)?.balance_due)),
               },
          };
     }

     async getInvoicesForBilling(billingIdRaw: unknown) {
          const billingId = positiveInt(billingIdRaw, 'billing id');
          const db = await this.db();
          return db('org_invoices as i')
               .whereExists(function () {
                    this.select(db.raw('1')).from('org_invoice_lines as l').whereRaw('l.invoice_id = i.id').andWhere('l.billing_id', billingId);
               })
               .select('i.id', 'i.invoice_number', 'i.status', 'i.invoice_date', 'i.amount_due', 'i.amount_paid', 'i.balance_due')
               .orderBy('i.id', 'desc');
     }

     async getInvoice(invoiceIdRaw: unknown) {
          const invoiceId = positiveInt(invoiceIdRaw, 'invoice id');
          const db = await this.db();
          const invoice = await db('org_invoices').where({ id: invoiceId }).first();
          if (!invoice) throw new OrganizationInvoiceError(404, 'Invoice not found.');

          const [lines, payments, organization, contact, company] = await Promise.all([
               db('org_invoice_lines')
                    .select('id', 'service_id', 'billing_id', 'patient_name', 'description', 'service_date', 'quantity',
                         'unit_price', 'discount', 'tax', 'line_total', 'prior_credit', 'amount_due', 'amount_paid')
                    .where({ invoice_id: invoiceId }).orderBy('id'),
               db('org_invoice_payments as p')
                    .leftJoin('paymentmodes as m', 'm.KeyID', 'p.payment_mode_id')
                    .leftJoin('roles as r', 'r.employeeid', 'p.received_by')
                    .select('p.id', 'p.amount', 'p.payment_mode_id', 'm.PaymentMode as payment_mode', 'p.payment_date', 'p.reference',
                         'p.notes', 'p.created_at', 'r.username as received_by_name')
                    .where('p.invoice_id', invoiceId).orderBy('p.id'),
               db('organization').select('*').where({ id: invoice.organization_id }).first(),
               db('organizationcontactperson').select('name', 'email', 'mobile').where({ organizationid: invoice.organization_id }).first(),
               getAllCompanyProfiles(this.tenantId).catch(() => null),
          ]);

          return {
               invoice,
               lines,
               payments,
               organization: organization ? {
                    id: organization.id,
                    name: organization.name || '',
                    address: organization.address || '',
                    street: organization.street || '',
                    location: organization.location || '',
                    region: organization.region || '',
                    mobile: organization.mobile || '',
                    email: organization.email || '',
                    contact: contact ? { name: contact.name || '', email: contact.email || '', mobile: contact.mobile || '' } : null,
               } : null,
               company: company || null,
          };
     }

     async getPaymentModes() {
          const db = await this.db();
          return db('paymentmodes').select('KeyID as id', 'PaymentMode as name').orderBy('KeyID');
     }

     async recordPayment(actor: AuthUser, invoiceIdRaw: unknown, input: RecordPaymentInput) {
          const invoiceId = positiveInt(invoiceIdRaw, 'invoice id');
          const amountCents = parsePaymentAmountCents(input.amount);
          const paymentModeId = positiveInt(input.paymentModeId, 'payment mode');
          const today = toDateOnly(new Date());
          const paymentDate = parseDateOnly(input.paymentDate, 'Payment date') || today;
          if (paymentDate > today) throw new OrganizationInvoiceError(400, 'Payment date cannot be in the future.');
          const reference = optionalText(input.reference, 'Payment reference', 120);
          const notes = optionalText(input.notes, 'Notes', 500);
          const idempotencyKey = input.idempotencyKey === undefined || input.idempotencyKey === null || input.idempotencyKey === ''
               ? null
               : optionalText(input.idempotencyKey, 'idempotencyKey', 80);
          if (idempotencyKey && !/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) {
               throw new OrganizationInvoiceError(400, 'idempotencyKey must be 8-80 letters, digits, dashes or underscores.');
          }

          const db = await this.db();
          const findExisting = async () => {
               if (!idempotencyKey) return null;
               const existing = await db('org_invoice_payments').select('id', 'invoice_id').where({ idempotency_key: idempotencyKey }).first();
               if (existing && Number(existing.invoice_id) !== invoiceId) {
                    throw new OrganizationInvoiceError(409, 'This payment key was already used for a different invoice.');
               }
               return existing ? Number(existing.id) : null;
          };

          const previous = await findExisting();
          if (previous) return { paymentId: previous, duplicate: true, invoice: await this.getInvoice(invoiceId) };

          try {
               const paymentId = await db.transaction(async trx => {
                    const invoice = await trx('org_invoices').where({ id: invoiceId }).forUpdate().first();
                    if (!invoice) throw new OrganizationInvoiceError(404, 'Invoice not found.');
                    if (invoice.status === 'void') throw new OrganizationInvoiceError(409, 'Payments cannot be recorded on a void invoice.');

                    const mode = await trx('paymentmodes').select('KeyID').where({ KeyID: paymentModeId }).first();
                    if (!mode) throw new OrganizationInvoiceError(400, 'Unknown payment mode.');

                    const lines = await trx('org_invoice_lines').where({ invoice_id: invoiceId }).orderBy('id').forUpdate();
                    for (const id of [...new Set<number>(lines.map((l: any) => Number(l.billing_id)))].sort((a,b) => a-b))
                         await lockMutableBill(trx, this.tenantId, id);
                    const serviceIds = lines.map((line: any) => Number(line.service_id));
                    const services = serviceIds.length === 0 ? [] : await trx('dboservices')
                         .whereIn('serviceid', serviceIds).forUpdate();
                    const serviceById = new Map<number, any>(services.map((s: any) => [Number(s.serviceid), s]));

                    const amountDue = toCents(invoice.amount_due);
                    const amountPaid = toCents(invoice.amount_paid);
                    const allocatable: AllocatableLine[] = lines.map((line: any) => ({
                         line_id: Number(line.id),
                         service_id: Number(line.service_id),
                         billing_id: Number(line.billing_id),
                         line_remaining_cents: toCents(line.amount_due) - toCents(line.amount_paid),
                         service_outstanding_cents: serviceById.has(Number(line.service_id)) ? toCents(serviceById.get(Number(line.service_id)).outstanding) : 0,
                    }));
                    const allocations = allocatePayment(amountCents, amountDue - amountPaid, allocatable);

                    const [insertedPayment] = await trx('org_invoice_payments').insert({
                         invoice_id: invoiceId,
                         amount: fromCents(amountCents),
                         payment_mode_id: paymentModeId,
                         payment_date: paymentDate,
                         reference,
                         notes,
                         idempotency_key: idempotencyKey,
                         received_by: actor.employeeid,
                    });
                    const newPaymentId = Number(insertedPayment);
                    if (!newPaymentId) throw new OrganizationInvoiceError(500, 'Unable to record the payment.');

                    // One legacy payment-history row per bill, posted to accounting through the outbox.
                    const perBilling = new Map<number, number>();
                    for (const allocation of allocations) {
                         perBilling.set(allocation.billing_id, (perBilling.get(allocation.billing_id) || 0) + allocation.amount_cents);
                    }
                    const historyByBilling = new Map<number, number>();
                    for (const [billingId, cents] of perBilling) {
                         const inserted = await trx('billinghx').insert({
                              billingid: billingId,
                              paymentmode: paymentModeId,
                              amount: fromCents(cents),
                              employeeid: actor.employeeid,
                              type: 'credit',
                         });
                         const historyId = Number(Array.isArray(inserted) ? inserted[0] : inserted);
                         if (!historyId) throw new OrganizationInvoiceError(500, 'Unable to record payment history.');
                         historyByBilling.set(billingId, historyId);
                         await enqueueBillingPayment(this.tenantId, historyId, billingId, fromCents(cents), actor.employeeid, trx);
                    }

                    for (const allocation of allocations) {
                         const service = serviceById.get(allocation.service_id);
                         const newPaid = toCents(service.paidamount) + allocation.amount_cents;
                         const newOutstanding = toCents(service.outstanding) - allocation.amount_cents;
                         await trx('dboservices').where({ serviceid: allocation.service_id }).update({
                              paidamount: fromCents(newPaid),
                              outstanding: fromCents(newOutstanding),
                              paymentstatus: servicePaymentStatus(newOutstanding, newPaid),
                         });
                         const updated = await trx('dboservices').where({ serviceid: allocation.service_id }).first();
                         if (updated) await applyDboservicesAfterUpdate(trx, updated, String(actor.employeeid));

                         await trx('org_invoice_lines').where({ id: allocation.line_id })
                              .update({ amount_paid: trx.raw('amount_paid + ?', [fromCents(allocation.amount_cents)]) });
                         await trx('org_invoice_payment_allocations').insert({
                              payment_id: newPaymentId,
                              line_id: allocation.line_id,
                              service_id: allocation.service_id,
                              billing_id: allocation.billing_id,
                              billinghx_id: historyByBilling.get(allocation.billing_id) || null,
                              amount: fromCents(allocation.amount_cents),
                         });
                    }

                    // Keep the bill header in step with its services, as multi-service payments do.
                    for (const billingId of perBilling.keys()) {
                         const billServices = await trx('dboservices').select('paidamount', 'outstanding').where({ billingid: billingId });
                         const totalPaid = billServices.reduce((sum: number, s: any) => sum + toCents(s.paidamount), 0);
                         const totalOutstanding = billServices.reduce((sum: number, s: any) => sum + toCents(s.outstanding), 0);
                         const billStatus = servicePaymentStatus(totalOutstanding, totalPaid);
                         await trx('billing').where({ billingid: billingId }).update({
                              paid: fromCents(totalPaid),
                              outstanding: fromCents(totalOutstanding),
                              status: billStatus,
                              clientstatus: billStatus,
                              lastupdatedby: actor.employeeid,
                         });
                    }

                    const newAmountPaid = amountPaid + amountCents;
                    await trx('org_invoices').where({ id: invoiceId }).update({
                         amount_paid: fromCents(newAmountPaid),
                         balance_due: fromCents(amountDue - newAmountPaid),
                         status: deriveInvoiceStatus(amountDue, newAmountPaid),
                         updated_at: trx.fn.now(),
                    });
                    return newPaymentId;
               });
               return { paymentId, duplicate: false, invoice: await this.getInvoice(invoiceId) };
          } catch (error) {
               if (isDuplicateKey(error) && idempotencyKey) {
                    const existing = await findExisting();
                    if (existing) return { paymentId: existing, duplicate: true, invoice: await this.getInvoice(invoiceId) };
               }
               throw error;
          }
     }

     /** Voids an invoice that has no payments and releases its services for re-invoicing. */
     async voidInvoice(actor: AuthUser, invoiceIdRaw: unknown, reasonRaw: unknown) {
          const invoiceId = positiveInt(invoiceIdRaw, 'invoice id');
          const reason = optionalText(reasonRaw, 'Reason', 500);
          if (reason.length < 3) throw new OrganizationInvoiceError(400, 'A reason is required to void an invoice.');

          const db = await this.db();
          await db.transaction(async trx => {
               const invoice = await trx('org_invoices').where({ id: invoiceId }).forUpdate().first();
               if (!invoice) throw new OrganizationInvoiceError(404, 'Invoice not found.');
               if (invoice.status === 'void') throw new OrganizationInvoiceError(409, 'Invoice is already void.');
               if (toCents(invoice.amount_paid) > 0) {
                    throw new OrganizationInvoiceError(409, 'An invoice with recorded payments cannot be voided.');
               }
               await trx('org_invoices').where({ id: invoiceId }).update({
                    status: 'void',
                    balance_due: 0,
                    voided_at: trx.fn.now(),
                    voided_by: actor.employeeid,
                    void_reason: reason,
                    updated_at: trx.fn.now(),
               });
               await trx('org_invoice_lines').where({ invoice_id: invoiceId }).update({ active_service_id: null });
          });
          return this.getInvoice(invoiceId);
     }
}
