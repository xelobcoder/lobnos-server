import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PharmacyEnterpriseCore, dateOnly, fingerprint, json, requiredText, requireManager, stockQuantity } from './PharmacyEnterpriseCore';
import { amount } from './accounting/PharmacyAccountingCore';
import { PharmacyAccountingCore } from './accounting/PharmacyAccountingCore';
import { pharmacyAccount } from './accounting/PharmacyAccountingCatalogue';
import { PharmacyJournalLine, postPharmacyJournal } from './PharmacyLedger';

export interface PharmacySupplierInvoiceInput {
     idempotencyKey: string;
     supplierId: string;
     reference: string;
     invoiceDate: string;
     dueDate?: string;
     reason?: string;
     lines: Array<{ deliveryId: string; lineId: string; quantity: number; amount: number | string }>;
     recoverableTax?: { account: 'asset:input_tax'; amount: number | string };
}

/** New GRNI-recognized deliveries only; legacy receipt invoice matching remains evidence-only. */
export class PharmacySupplierInvoices extends PharmacyEnterpriseCore {
     async record(input: PharmacySupplierInvoiceInput): Promise<any> {
          return this.post(input);
     }
     async post(input: PharmacySupplierInvoiceInput): Promise<any> {
          requireManager(this.user);
          return this.atomic(input, 'supplier_invoice:post', async trx => {
               if (!Number.isSafeInteger(this.user.tenantId) || this.user.tenantId <= 0) throw new Error('An authenticated tenant is required');
               if (Object.keys(input).some(key => !['idempotencyKey', 'supplierId', 'reference', 'invoiceDate', 'dueDate', 'reason', 'lines', 'recoverableTax'].includes(key)))
                    throw new Error('Invoice tax, charges and adjustments require an explicit configured purchase-tax or variance workflow');
               const reference = requiredText(input.reference, 'supplier invoice reference', 128);
               const reason = requiredText(input.reason || 'Accepted delivery supplier invoice', 'invoice evidence', 500);
               const invoiceDate = dateOnly(input.invoiceDate), dueDate = input.dueDate == null ? null : dateOnly(input.dueDate);
               if (invoiceDate > new Date().toISOString().slice(0, 10)) throw new Error('Supplier invoice date cannot be in the future');
               if (dueDate && dueDate < invoiceDate) throw new Error('Invoice due date cannot precede its invoice date');
               if (typeof input.supplierId !== 'string' || !input.supplierId || input.supplierId.length > 64) throw new Error('Choose a pharmacy supplier');
               const supplier = await trx('pharmacy_suppliers').where({ id: input.supplierId, branchid: this.branch }).forUpdate().first();
               if (!supplier) throw new Error('Supplier not found in this branch');
               const requestKey = 'supplier-invoice:' + fingerprint([supplier.id, reference.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()]);
               if (await trx('pharmacy_documents').where({ request_key: requestKey }).first()) throw new Error('This supplier invoice reference is already recorded');
               if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100 ||
                    input.lines.some(line => !line || typeof line.deliveryId !== 'string' || !line.deliveryId || line.deliveryId.length > 36 || typeof line.lineId !== 'string' || !line.lineId || line.lineId.length > 36) ||
                    new Set(input.lines.map(line => JSON.stringify([line.deliveryId, line.lineId]))).size !== input.lines.length)
                    throw new Error('Select 1-100 distinct accepted delivery lines');
               const deliveries = new Map<string, any>();
               for (const deliveryId of [...new Set(input.lines.map(line => line.deliveryId))].sort()) {
                    const row = await this.workflow(trx, deliveryId, 'goods_delivery');
                    if (row.details.schemaVersion !== 2 || row.details.recognition !== 'grni' || row.details.supplierId !== supplier.id)
                         throw new Error('Only this supplier’s GRNI-recognized deliveries can be invoiced; legacy receipts must use evidence-only matching');
                    if (!Array.isArray(row.details.lines)) throw new Error('Delivery line evidence is unavailable');
                    const deliveredDate = row.created_at instanceof Date ? dateOnly(row.created_at) : String(row.created_at || '').slice(0, 10);
                    if (deliveredDate && invoiceDate < dateOnly(deliveredDate)) throw new Error('Invoice recognition cannot precede its delivery');
                    const acceptance = await trx('pharmacy_enterprise_events').where({ workflow_id: row.id, branchid: this.branch, action: 'delivery_accepted' }).orderBy('created_at', 'desc').first();
                    if (acceptance && invoiceDate < dateOnly(acceptance.created_at instanceof Date ? acceptance.created_at : String(acceptance.created_at).slice(0, 10)))
                         throw new Error('Invoice recognition cannot precede accepted stock recognition');
                    deliveries.set(deliveryId, row);
               }
               const id = randomUUID(), billId = randomUUID(), lines: any[] = [];
               let total = new Decimal(0);
               for (const allocation of input.lines) {
                    if (Object.keys(allocation).some(key => !['deliveryId', 'lineId', 'quantity', 'amount'].includes(key))) throw new Error('Unsupported invoice line adjustment');
                    const row = deliveries.get(allocation.deliveryId), line = row.details.lines.find((candidate: any) => candidate.id === allocation.lineId);
                    if (!line) throw new Error('Accepted delivery line not found');
                    const count = new Decimal(stockQuantity(allocation.quantity));
                    const accepted = new Decimal(stockQuantity(Number(line.acceptedQuantity), true));
                    const used = new Decimal(stockQuantity(Number(line.invoiceQuantity || 0), true));
                    const acceptedValue = new Decimal(amount(line.acceptedValue, false, true));
                    const invoiceAmount = new Decimal(amount(line.invoiceAmount ?? 0, false, true));
                    if (accepted.isZero() || used.plus(count).gt(accepted)) throw new Error('Invoice quantity exceeds accepted uninvoiced quantity');
                    if (invoiceAmount.gt(acceptedValue)) throw new Error('Existing invoice allocations do not reconcile to accepted value');
                    // The last allocation absorbs prior cent rounding, never increasing accepted value.
                    const expected = used.plus(count).eq(accepted) ? acceptedValue.minus(invoiceAmount) :
                         acceptedValue.times(count).dividedBy(accepted).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                    const value = new Decimal(amount(allocation.amount, false, true));
                    if (!value.eq(expected) || invoiceAmount.plus(value).gt(acceptedValue))
                         throw new Error('Invoice line amount must match its accepted value allocation (' + expected.toFixed(2) + '); resolve price differences before posting');
                    const snapshot = { deliveryId: row.id, lineId: line.id, itemId: line.itemId, quantity: count.toNumber(), amount: value.toFixed(2) };
                    lines.push(snapshot); total = total.plus(value);
                    line.invoiceQuantity = used.plus(count).toNumber();
                    line.invoiceAmount = invoiceAmount.plus(value).toFixed(2);
                    line.invoiceAllocations = [...(line.invoiceAllocations || []), { invoiceId: id, quantity: count.toNumber(), amount: value.toFixed(2) }];
               }
               const inventoryAmount = amount(total.toFixed(2));
               let recoverableTax: { account: string; amount: string; sharedAccount: string | null } | null = null;
               if (input.recoverableTax !== undefined) {
                    if (!input.recoverableTax || typeof input.recoverableTax !== 'object' ||
                         Object.keys(input.recoverableTax).some(key => !['account', 'amount'].includes(key)) ||
                         input.recoverableTax.account !== 'asset:input_tax')
                         throw new Error('Recoverable purchase tax requires the explicitly configured asset:input_tax account and documented amount');
                    const taxAmount = amount(input.recoverableTax.amount);
                    const settings = await trx('pharmacy_accounting_settings').where({ branchid: this.branch }).forUpdate().first();
                    if (settings && Number(settings.tenant_id) !== this.user.tenantId) throw new Error('Purchase tax accounting configuration does not belong to this tenant');
                    const linked = Boolean(settings?.enabled);
                    const account = await pharmacyAccount(trx, this.branch, { enabled: linked, mappings: json(settings?.mappings) }, 'asset:input_tax');
                    recoverableTax = { account: 'asset:input_tax', amount: taxAmount, sharedAccount: linked ? account.account_code : null };
               }
               const gross = total.plus(recoverableTax?.amount || 0), value = amount(gross.toFixed(2));
               const finance = new PharmacyAccountingCore(trx, { tenantId: this.user.tenantId, branch: this.branch, actor: this.actor, role: this.user.role });
               await finance.postingAllowed(trx, invoiceDate);
               const result = { id, billId, supplierId: supplier.id, supplierName: supplier.name, reference, invoiceDate, dueDate, amount: value, inventoryAmount, recoverableTax, lines, recognition: 'supplier_invoice', schemaVersion: 2 };
               await trx('pharmacy_documents').insert({ id, branchid: this.branch, kind: 'supplier_invoice', request_key: requestKey,
                    request_hash: fingerprint(input), supplier_id: supplier.id, amount: value, details: JSON.stringify({ ...result, reason }),
                    created_by: this.actor, created_at: new Date() });
               const journalLines: PharmacyJournalLine[] = [
                    { account: 'liability:grni', debit: total.toNumber(), documentRef: id },
                    ...(recoverableTax ? [{ account: recoverableTax.account, debit: Number(recoverableTax.amount), documentRef: id }] : []),
                    { account: 'payable:' + supplier.id, credit: gross.toNumber(), documentRef: id },
               ];
               await postPharmacyJournal(trx, this.branch, id, 'supplier_invoice', reason, this.actor, journalLines, invoiceDate);
               await trx('pharmacy_accounting_bills').insert({ id: billId, branchid: this.branch, supplier_id: supplier.id,
                    source_kind: 'supplier_invoice', source_ref: id, reference, document_date: invoiceDate, due_date: dueDate, amount: value, created_by: this.actor });
               for (const row of deliveries.values()) await this.status(trx, row, row.status, row.details);
               await this.event(trx, 'supplier_invoice_posted', result, id);
               return result;
          }).catch(async error => {
               // Concurrent absent-key retries can meet the reference constraint after the first commit.
               if (!input || typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw error;
               const retry = await this.db('pharmacy_enterprise_requests').where({ request_key: input.idempotencyKey }).first();
               if (retry && retry.request_hash === fingerprint({ operation: 'supplier_invoice:post', branch: this.branch, actor: this.actor,
                    input: { ...input, witnessPin: undefined, pin: undefined } })) return json(retry.response);
               throw error;
          });
     }
}
