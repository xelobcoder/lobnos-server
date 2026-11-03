import { randomInt, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PharmacyEnterpriseCore, json, requireManager } from './PharmacyEnterpriseCore';
import { PharmacySaleRepository } from './repositories/PharmacySaleRepository';
import { PharmacySaleService } from './services/PharmacySaleService';
import { pharmacyTransactionPriceType, pharmacyUnitPrice, money, quantity } from './PharmacyRules';
import { roleAllowed } from '../../middleware/roles';
import { pharmacyAvailability } from './PharmacyAvailability';
const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function counterCode() { return Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''); }
export function normalizeCounterCode(value: unknown) { const code = String(value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(code))
    throw new Error('Enter the four-character counter code'); return code; }
export function counterInvoiceReference(value: unknown) {
    const reference = String(value || '').trim().toUpperCase();
    if (/^[A-Z0-9]{4}$/.test(reference)) return {code: reference};
    if (/^INV-[A-Z0-9]{4}-\d+$/.test(reference) && reference.length <= 80) return {invoice_number: reference};
    throw new Error('Enter the four-character counter code or full invoice number');
}
export const counterDispensingRoles = ['admin', 'pharmacy_manager', 'pharmacist', 'pharmacy_dispensary_officer'];
export const counterCashierRoles = ['admin', 'pharmacy_manager', 'pharmacy_cashier', 'pharmacy_accountant'];
export async function pharmacyCheckoutMode(db: any, branch: number) { return (await db('pharmacy_checkout_settings').where({ branchid: branch }).first())?.mode || 'direct'; }
export class PharmacyCounterWorkflow extends PharmacyEnterpriseCore {
    constructor(db: any, user: any, readonly tenant: number, private readonly saleService = new PharmacySaleService(new PharmacySaleRepository(tenant, Number(user.branch)), Number(user.branch)), private readonly codeGenerator = counterCode) { super(db, user); }
    private authorize(roles: string[]) { if (!roleAllowed(this.user.role, roles))
        throw new Error('You do not have authority for this counter action'); }
    async settings() { return this.db.transaction(async (trx: any) => ({ mode: await pharmacyCheckoutMode(trx, this.branch) })); }
    private async lockSettings(trx: any) { await trx('pharmacy_checkout_settings').insert({ branchid: this.branch, mode: 'direct', updated_at: new Date() }).onConflict(['branchid']).ignore(); return trx('pharmacy_checkout_settings').where({ branchid: this.branch }).forUpdate().first(); }
    async saveSettings(input: any) { requireManager(this.user); if (!['direct', 'separate_cashier'].includes(input.mode))
        throw new Error('Choose a pharmacy checkout workflow'); return this.atomic(input, 'counter-settings', async (trx) => { await this.lockSettings(trx); await trx('pharmacy_checkout_settings').where({ branchid: this.branch }).update({ mode: input.mode, updated_by: this.actor, updated_at: new Date() }); await this.event(trx, 'checkout-mode-changed', { mode: input.mode }); return { mode: input.mode }; }); }
    private publicRow(row: any) { return { ...row, details: json(row.details), total: Number(row.total) }; }
    async find(code: unknown) { this.authorize([...counterCashierRoles, ...counterDispensingRoles]); return this.db.transaction(async (trx: any) => { const row = await trx('pharmacy_counter_invoices').where({ branchid: this.branch, ...counterInvoiceReference(code) }).first(); if (!row)
        throw new Error('No invoice with this code or number in the current branch'); const sale = row.sale_id ? await trx('pharmacy_sales').where({ id: row.sale_id, branchid: this.branch }).first() : null; const company = await trx('companyprofile').select('name', 'address', 'street', 'phonenumber', 'alternativenumber', 'email', 'website').first(); const details = json(row.details); const patient = details.patientId ? await trx('new_patients').where({ patientid: details.patientId }).first() : null; return { ...this.publicRow(row), company: company || {}, patientName: patient ? [patient.firstname, patient.middlename, patient.lastname].filter(Boolean).join(' ') : undefined, saleStatus: sale?.status || null, outstandingAmount: sale ? Number(sale.outstanding_amount || 0) : null }; }); }
    async uncollected(input: {status?: unknown; search?: unknown; page?: unknown; count?: unknown}) {
        this.authorize([...counterCashierRoles, ...counterDispensingRoles]);
        const status = input.status ?? 'paid', search = String(input.search ?? '').trim();
        const page = Number(input.page ?? 1), count = Number(input.count ?? 25);
        if (!['paid', 'unpaid', 'all'].includes(String(status))) throw new Error('Choose paid, unpaid or all uncollected invoices');
        if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(count) || count < 1 || count > 100 || !Number.isSafeInteger((page - 1) * count)) throw new Error('Invalid invoice pagination');
        if (search.length > 80) throw new Error('Invoice search must be at most 80 characters');
        return this.db.transaction(async (trx: any) => {
            const query = trx('pharmacy_counter_invoices').where({branchid: this.branch}).whereIn('status', status === 'all' ? ['paid', 'unpaid'] : [status]);
            if (search) {
                const pattern = `%${search}%`;
                query.whereRaw('(invoice_number LIKE ? OR code LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(details, ?)) LIKE ?)', [pattern, pattern, '$.customerName', pattern]);
            }
            const aggregate = await query.clone().count('* as total').first();
            const total = Number(aggregate.total), currentPage = Math.min(page, Math.max(1, Math.ceil(total / count)));
            const rows = await query.orderBy('created_at', 'asc').orderBy('sequence', 'asc').limit(count).offset((currentPage - 1) * count);
            const ids = rows.map((row: any) => row.sale_id).filter(Boolean);
            const sales = ids.length ? await trx('pharmacy_sales').where({branchid: this.branch}).whereIn('id', ids).select('id', 'status', 'outstanding_amount') : [];
            return {
                total, page: currentPage, count,
                invoices: rows.map((row: any) => {
                    const sale = sales.find((entry: any) => entry.id === row.sale_id);
                    const details = json(row.details);
                    return {
                        id: row.id, code: row.code, invoice_number: row.invoice_number, status: row.status, total: Number(row.total),
                        customerName: details.customerName, itemCount: details.lines?.length || 0, attendant_name: row.attendant_name,
                        created_at: row.created_at, paid_at: row.paid_at, saleStatus: sale?.status || null,
                        outstandingAmount: sale ? Number(sale.outstanding_amount || 0) : null,
                    };
                }),
            };
        });
    }
    async create(input: any) {
        this.authorize(counterDispensingRoles);
        return this.atomic(input, 'counter-create', async (trx) => {
            const source = input.recoverySourceId ? await this.invoice(trx, input.recoverySourceId) : null;
            if (source) {
                this.authorizeRecovery(source);
                const original = json(source.details);
                if (original.replacementId) return this.publicRow(await this.invoice(trx, original.replacementId));
                if (source.status !== 'cancelled') throw new Error('Explicitly cancel and recover the original invoice before reissuing');
                // Identity and transaction pricing belong to the source, not to the browser.
                input = { ...input, customerName: original.customerName, patientId: original.patientId, priceType: original.priceType, heldSaleId: undefined };
            }
            const settings = await this.lockSettings(trx);
            if (settings.mode !== 'separate_cashier')
                throw new Error('Separate cashier workflow is not enabled for this branch');
            const repository = new PharmacySaleRepository(this.tenant, this.branch);
            if (input.heldSaleId && !await repository.lockHeldSale(input.heldSaleId, trx))
                throw new Error('This suspended sale is no longer available');
            if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100 || new Set(input.lines.map((l: any) => l.inventoryItemId)).size !== input.lines.length)
                throw new Error('Select up to 100 distinct medicines');
            if (input.patientId != null && (!Number.isInteger(input.patientId) || input.patientId <= 0))
                throw new Error('Invalid patient');
            const priceType = pharmacyTransactionPriceType(input), items = await repository.lockSellableItems(input.lines.map((l: any) => l.inventoryItemId), trx);
            if (items.length !== input.lines.length)
                throw new Error('One or more medicines are unavailable in this branch');
            const lines = input.lines.map((line: any) => { const item = items.find(i => i.id === line.inventoryItemId)!; if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0 || quantity(line.quantity) !== line.quantity)
                throw new Error('Enter valid medicine quantities'); if (item.currentStock < line.quantity)
                throw new Error(item.name + ' has insufficient stock'); if (item.requiresPrescription)
                throw new Error(item.name + ' requires a prescription; use the prescription queue'); const unitPrice = pharmacyUnitPrice(item, priceType); return { inventoryItemId: item.id, name: item.name, sku: item.sku, quantity: line.quantity, priceType, unitPrice, lineTotal: money(new Decimal(unitPrice).mul(line.quantity)) }; });
            const total = money(lines.reduce((sum: number, line: any) => sum + line.lineTotal, 0));
            if (total <= 0 || total !== input.expectedTotal)
                throw new Error('Prices changed. Refresh and review the basket before creating an invoice');
            let code = '';
            for (let i = 0; i < 64; i++) {
                const candidate = this.codeGenerator();
                if (!await trx('pharmacy_counter_invoices').where({ branchid: this.branch, code: candidate }).first()) {
                    code = candidate;
                    break;
                }
            }
            if (!code)
                throw new Error('Unable to allocate a short code. Retry creating this invoice');
            const id = randomUUID(), now = new Date(), details = { customerName: String(input.customerName || 'Walk-in customer').trim().slice(0, 255), patientId: input.patientId || null, priceType, lines, ...(source ? { recoverySourceId: source.id } : {}) };
            const staff = await trx('roles').where({ employeeid: this.actor }).first();
            const [sequence] = await trx('pharmacy_counter_invoices').insert({ id, branchid: this.branch, code, status: 'unpaid', details: JSON.stringify(details), total, attendant_id: this.actor, attendant_name: String(staff?.username || (this.user as any).username || 'Staff #' + this.actor).slice(0, 255), created_at: now, updated_at: now });
            const invoiceNumber = `INV-${code}-${String(sequence).padStart(5, '0')}`;
            await trx('pharmacy_counter_invoices').where({ id }).update({ invoice_number: invoiceNumber });
            if (source) await trx('pharmacy_counter_invoices').where({ id: source.id }).update({ details: JSON.stringify({ ...json(source.details), replacementId: id }), updated_at: now });
            if (input.heldSaleId)
                await repository.deleteHeldSale(input.heldSaleId, trx);
            await this.event(trx, 'counter-invoice-created', { code, total }, id);
            return { id, code, invoice_number: invoiceNumber, status: 'unpaid', total, details };
        });
    }
    private async invoice(trx: any, id: string) { const row = await trx('pharmacy_counter_invoices').where({ id, branchid: this.branch }).forUpdate().first(); if (!row)
        throw new Error('Invoice not found in this branch'); return row; }
    private canRecover(row: any) {
        return roleAllowed(this.user.role, counterDispensingRoles) &&
            (Number(row.attendant_id) === this.actor || roleAllowed(this.user.role, ['admin', 'pharmacy_manager']));
    }
    private authorizeRecovery(row: any) {
        if (!this.canRecover(row)) throw new Error('Return this invoice to its original attendant or a pharmacy manager for cancellation and reissue');
    }
    private async recoveryReview(trx: any, row: any) {
        const details = json(row.details), repository = new PharmacySaleRepository(this.tenant, this.branch);
        const ids: string[] = details.lines.map((line: any) => line.inventoryItemId), blocked = new Map<string, string>();
        const reviewBlock = (error: any) => !error.code && /frozen for a stock count|cold-chain excursion/.test(error.message || '');
        let items: Awaited<ReturnType<PharmacySaleRepository['lockSellableItems']>>;
        try { items = await repository.lockSellableItems(ids, trx); }
        catch (error) {
            if (!reviewBlock(error)) throw error;
            // A blocked medicine must remain visible for explicit removal, not strand the entire basket.
            items = [];
            for (const id of [...ids].sort()) {
                try { items.push(...await repository.lockSellableItems([id], trx)); }
                catch (error: any) { if (!reviewBlock(error)) throw error; blocked.set(id, error.message + '. Remove this line or resolve the stock restriction.'); }
            }
        }
        const availability = await pharmacyAvailability(trx, items.map(item => ({ ...item, batchTracking: Boolean(item.batchTracking) })));
        const lines = details.lines.map((line: any) => {
            const item = items.find(item => item.id === line.inventoryItemId);
            const stock = item ? availability.get(item.id) || 0 : 0;
            let issue = blocked.get(line.inventoryItemId) || (!item ? 'Unavailable in this branch. Remove or replace this line.' :
                item.requiresPrescription ? 'Requires a prescription. Remove and use the prescription queue.' :
                stock < line.quantity ? 'Insufficient unexpired stock. Reduce quantity or remove this line.' : '');
            let price = 0;
            if (item) {
                try { price = pharmacyUnitPrice(item, details.priceType); }
                catch { issue = 'Current price unavailable. Configure a price or remove this line.'; }
            }
            return { ...line, name: item?.name || line.name, sku: item?.sku || line.sku,
                salePrice: Number(item?.salePrice || 0), wholesalePrice: Number(item?.wholesalePrice || 0),
                unitPrice: price, lineTotal: money(new Decimal(price).mul(line.quantity)),
                availableStock: item?.currentStock || 0, dispensableStock: stock, requiresPrescription: item?.requiresPrescription || false,
                unavailable: !item, issue };
        });
        const replacement = details.replacementId ? await trx('pharmacy_counter_invoices').where({ id: details.replacementId, branchid: this.branch }).first() : null;
        return { invoice: this.publicRow(row), replacement: replacement ? { code: replacement.code, invoice_number: replacement.invoice_number } : null, canRecover: this.canRecover(row), lines,
            refreshedTotal: money(lines.reduce((sum: number, line: any) => sum + line.lineTotal, 0)) };
    }
    async review(id: string) {
        this.authorize([...counterCashierRoles, ...counterDispensingRoles]);
        return this.db.transaction(async (trx: any) => this.recoveryReview(trx, await this.invoice(trx, id)));
    }
    async recover(id: string, input: any) {
        this.authorize(counterDispensingRoles);
        return this.atomic(input, 'counter-recover:' + id, async trx => {
            const row = await this.invoice(trx, id);
            this.authorizeRecovery(row);
            if (!['unpaid', 'cancelled'].includes(row.status)) throw new Error('Only unpaid or cancelled invoices can be recovered. Do not collect another payment');
            if (json(row.details).replacementId) throw new Error('This invoice has already been reissued. Open its replacement instead');
            if (row.status === 'unpaid') {
                if (typeof input.reason !== 'string' || input.reason.trim().length < 5) throw new Error('Enter a cancellation reason of at least five characters');
                await trx('pharmacy_counter_invoices').where({ id }).update({ status: 'cancelled', updated_at: new Date() });
                await this.event(trx, 'counter-cancelled', { reason: input.reason.trim(), basketRecovery: true }, id);
            }
            return this.recoveryReview(trx, { ...row, status: 'cancelled' });
        });
    }
    async pay(id: string, input: any) { this.authorize(counterCashierRoles); return this.atomic(input, 'counter-pay:' + id, async (trx) => { const row = await this.invoice(trx, id); if (row.status !== 'unpaid')
        throw new Error('This invoice is ' + row.status + '. Reload it; do not collect payment again'); if (!['cash', 'card', 'mobile_money'].includes(input.paymentMethod))
        throw new Error('A counter invoice requires full payment by cash, card or mobile money'); const details = json(row.details); const receipt = await this.saleService.completeSale({ idempotencyKey: 'counter:' + id, customerName: details.customerName, patientId: details.patientId, priceType: details.priceType, lines: details.lines.map((l: any) => ({ inventoryItemId: l.inventoryItemId, quantity: l.quantity, priceType: l.priceType })), expectedTotal: Number(row.total), paymentMethod: input.paymentMethod, amountTendered: input.amountTendered, paymentReference: input.paymentReference }, this.actor, trx); await trx('pharmacy_sales').where({ id: receipt.id }).update({ receipt_number: row.invoice_number }); await trx('pharmacy_counter_invoices').where({ id }).update({ status: 'paid', sale_id: receipt.id, cashier_id: this.actor, paid_at: new Date(), updated_at: new Date() }); await this.event(trx, 'counter-payment-recorded', { saleId: receipt.id }, id); return { ...receipt, receiptNumber: row.invoice_number, counterCode: row.code, invoiceNumber: row.invoice_number, attendantName: row.attendant_name, collectionStatus: 'paid' }; }); }
    async collect(id: string, input: any) { this.authorize(counterDispensingRoles); return this.atomic(input, 'counter-collect:' + id, async (trx) => { const row = await this.invoice(trx, id); if (row.status !== 'paid')
        throw new Error('Only a paid, uncollected invoice can be handed over'); const sale = await trx('pharmacy_sales').where({ id: row.sale_id, branchid: this.branch }).forUpdate().first(); if (!sale || sale.status !== 'completed' || Number(sale.outstanding_amount || 0) > 0)
        throw new Error('This sale is not fully paid or has been reversed. Do not release medicines'); await trx('pharmacy_counter_invoices').where({ id }).update({ status: 'collected', collected_by: this.actor, collected_at: new Date(), updated_at: new Date() }); await this.event(trx, 'counter-collected', { saleId: row.sale_id }, id); return { id, status: 'collected', code: row.code }; }); }
    async cancel(id: string, input: any) { this.authorize(counterDispensingRoles); if (typeof input.reason !== 'string' || input.reason.trim().length < 5)
        throw new Error('Enter a cancellation reason of at least five characters'); return this.atomic(input, 'counter-cancel:' + id, async (trx) => { const row = await this.invoice(trx, id); if (row.status !== 'unpaid')
        throw new Error('Only an unpaid invoice can be cancelled; use the existing reversal process for payments'); if (row.attendant_id !== this.actor && !roleAllowed(this.user.role, ['admin', 'pharmacy_manager']))
        throw new Error('Only its attendant or a pharmacy manager can cancel this invoice'); await trx('pharmacy_counter_invoices').where({ id }).update({ status: 'cancelled', updated_at: new Date() }); await this.event(trx, 'counter-cancelled', { reason: input.reason.trim() }, id); return { id, status: 'cancelled' }; }); }
}
