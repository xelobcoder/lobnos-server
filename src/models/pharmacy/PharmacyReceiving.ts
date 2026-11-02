import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { PharmacyEnterpriseCore, assertBatchNotRecalled, assertNoStockCount, dateOnly, fingerprint, json, requireManager, requiredText, stockQuantity } from './PharmacyEnterpriseCore';
import { assertPharmacyDayOpen, postPharmacyJournal } from './PharmacyLedger';
import { money, pharmacyReceivingUnits, quantity, validatePharmacyReceipt } from './PharmacyRules';
import { PharmacyPriceChoice, calculatePharmacyPrice, priceIncrement, procurementAmount } from './PharmacyPricing';

type PolicyMode = 'approval' | 'tolerance' | 'prohibit';
export interface ReceivingPolicy { mode: PolicyMode; tolerancePercent: number; roundingIncrement: number; version: number }
export interface DeliveryLine {
     id: string; itemId: string; name: string; sku: string; orderLineId?: string;
     quantityDelivered: number; purchaseQuantity: number; conversionFactor: number;
     unitCost: number | null; purchaseUnitCost: number | null; totalValue: number | null;
     acceptedQuantity: number; acceptedValue: number; returnedQuantity: number;
     batchNumber: string; expiryDate: string | null; condition: 'good' | 'damaged' | 'expired';
     suggestedAcceptance: number; discountAmount: number; nonRecoverableTaxAmount: number; allocatedAdditionalCost: number;
}
interface DeliveryInputLine {
     itemId: string; orderLineId?: string; quantity: number; unitCost?: number;
     unitType?: 'consumption' | 'purchase'; unitsPerPurchaseUnit?: number;
     batchNumber?: string; expiryDate?: string; condition?: DeliveryLine['condition'];
     discountAmount?: number; nonRecoverableTaxAmount?: number;
}
interface RecordInput {
     idempotencyKey: string; supplierId: string; orderId?: string; reference: string; reason?: string;
     lines: DeliveryInputLine[]; additionalCost?: number;
}
interface AcceptanceInput {
     idempotencyKey: string; expectedVersion: number; reason?: string; excessApproved?: boolean;
     lines: Array<{ lineId: string; quantity: number; unitCost?: number }>;
     pricing?: Array<PharmacyPriceChoice & { itemId: string; wholesale?: PharmacyPriceChoice }>;
}
const defaultPolicy: ReceivingPolicy = { mode: 'approval', tolerancePercent: 0, roundingIncrement: 0.01, version: 0 };
const maxLines = 100;
function distinctLines(lines: Array<{ lineId: string }>): void {
     if (!Array.isArray(lines) || !lines.length || lines.length > maxLines ||
          lines.some(line => !line || typeof line.lineId !== 'string') || new Set(lines.map(line => line.lineId)).size !== lines.length)
          throw new Error('Choose 1 to 100 distinct delivery lines');
}
function disposition(lines: DeliveryLine[]): string {
     const outstanding = lines.some(line => quantity(line.quantityDelivered - line.acceptedQuantity - line.returnedQuantity) > 0);
     return outstanding ? (lines.some(line => line.acceptedQuantity > 0) ? 'partially_accepted' : 'held') : (lines.some(line => line.acceptedQuantity > 0) ? 'accepted' : 'returned');
}

export class PharmacyReceiving extends PharmacyEnterpriseCore {
     declare readonly db: Knex;
     private async policy(trx: Knex.Transaction): Promise<ReceivingPolicy> {
          const row = await trx('pharmacy_procurement_settings').where({ branchid: this.branch }).forUpdate().first();
          return row ? { mode: row.mode, tolerancePercent: Number(row.tolerance_percent), roundingIncrement: Number(row.rounding_increment), version: Number(row.version) } : { ...defaultPolicy };
     }
     async setup() {
          return this.db.transaction(async trx => {
               const [items, suppliers, orders, policy] = await Promise.all([
                    trx('pharmacy_inventory_items').where({ branchid: this.branch, is_active: true }).orderBy('name'),
                    trx('pharmacy_suppliers').where({ branchid: this.branch, is_active: true }).orderBy('name'),
                    trx('pharmacy_purchase_orders').where({ branchid: this.branch }).whereNotIn('status', ['cancelled']).orderBy('created_at', 'desc').limit(200),
                    this.policy(trx),
               ]);
               const lines = orders.length ? await trx('pharmacy_purchase_order_lines').whereIn('order_id', orders.map(order => order.id)) : [];
               const orderIds = new Set(orders.map(order => order.id));
               return { items, suppliers, orders: orders.map(order => ({ ...order, lines: lines.filter(line => orderIds.has(line.order_id) && line.order_id === order.id).map(line => ({ ...line, name: items.find(item => item.id === line.item_id)?.name })) })), policy };
          });
     }
     async deliveries() {
          return this.db.transaction(async trx => (await trx('pharmacy_workflows').where({ branchid: this.branch, kind: 'goods_delivery' }).orderBy('created_at', 'desc').limit(200)).map(row => ({ ...row, details: json(row.details) })));
     }
     async invoices() {
          return this.db.transaction(async trx => (await trx('pharmacy_documents').where({ branchid: this.branch, kind: 'supplier_invoice' }).orderBy('created_at', 'desc').limit(200)).map(row => ({ ...row, details: json(row.details) })));
     }
     async previewPrice(input: { deliveryId: string; itemId: string; lines: AcceptanceInput['lines']; method: PharmacyPriceChoice['method']; value?: number }) {
          distinctLines(input.lines);
          return this.db.transaction(async trx => {
               const row = await this.workflow(trx, input.deliveryId, 'goods_delivery');
               const lines: DeliveryLine[] = row.details.lines;
               let total = new Decimal(0), count = new Decimal(0);
               for (const selected of input.lines) {
                    const line = lines.find(candidate => candidate.id === selected.lineId && candidate.itemId === input.itemId);
                    if (!line) throw new Error('Choose accepted quantities for this medicine');
                    const amount = stockQuantity(selected.quantity);
                    if (amount > quantity(line.quantityDelivered - line.acceptedQuantity - line.returnedQuantity)) throw new Error('Preview quantity exceeds physically held goods');
                    const cost = line.unitCost ?? procurementAmount(selected.unitCost, 'actual base-unit cost');
                    const value = line.totalValue ?? money(new Decimal(cost).mul(line.quantityDelivered));
                    const target = money(new Decimal(value).mul(quantity(line.acceptedQuantity + amount)).div(line.quantityDelivered));
                    total = total.plus(target).minus(line.acceptedValue); count = count.plus(amount);
               }
               return calculatePharmacyPrice(total.div(count).toNumber(), input, row.details.policy.roundingIncrement);
          });
     }
     async savePolicy(input: { idempotencyKey: string; mode: PolicyMode; tolerancePercent: number; roundingIncrement: number; reason: string }) {
          requireManager(this.user);
          if (!['approval', 'tolerance', 'prohibit'].includes(input.mode) || typeof input.tolerancePercent !== 'number' ||
               !Number.isFinite(input.tolerancePercent) || input.tolerancePercent < 0 || input.tolerancePercent > 100 ||
               quantity(input.tolerancePercent) !== input.tolerancePercent)
               throw new Error('Choose a receiving policy and a tolerance from 0 to 100%');
          const increment = priceIncrement(input.roundingIncrement), reason = requiredText(input.reason, 'policy change reason');
          return this.atomic(input, 'receiving_policy', async trx => {
               const previous = await this.policy(trx);
               const row = { branchid: this.branch, mode: input.mode, tolerance_percent: input.tolerancePercent, rounding_increment: increment,
                    version: previous.version + 1, updated_by: this.actor, updated_at: new Date() };
               if (previous.version) await trx('pharmacy_procurement_settings').where({ branchid: this.branch }).update(row);
               else await trx('pharmacy_procurement_settings').insert(row);
               await this.event(trx, 'receiving_policy_changed', { previous, next: row, reason });
               return { mode: input.mode, tolerancePercent: input.tolerancePercent, roundingIncrement: increment, version: row.version };
          });
     }
     async record(input: RecordInput) {
          if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > maxLines)
               throw new Error('Record 1 to 100 delivered batch lines');
          const reference = requiredText(input.reference, 'delivery reference', 120);
          if (typeof input.supplierId !== 'string' || !input.supplierId || input.supplierId.length > 64 ||
               (input.orderId !== undefined && (typeof input.orderId !== 'string' || !input.orderId || input.orderId.length > 64)))
               throw new Error('Choose a valid supplier and optional purchase order');
          return this.atomic(input, 'goods_delivery', async trx => {
               const supplier = await trx('pharmacy_suppliers').where({ id: input.supplierId, branchid: this.branch, is_active: true }).forUpdate().first();
               if (!supplier) throw new Error('Select an active pharmacy supplier in this branch');
               const documentKey = 'delivery:' + fingerprint({ branch: this.branch, supplier: supplier.id, reference: reference.toLocaleLowerCase() });
               if (await trx('pharmacy_documents').where({ request_key: documentKey }).first()) throw new Error('This supplier delivery reference is already recorded');
               const order = input.orderId ? await trx('pharmacy_purchase_orders').where({ id: input.orderId, branchid: this.branch, supplier_id: supplier.id }).forUpdate().first() : null;
               if (input.orderId && (!order || order.status === 'cancelled')) throw new Error('Select an available order for this supplier and branch');
               const policy = await this.policy(trx), id = randomUUID(), lines: DeliveryLine[] = [];
               const pending = new Map<string, number>();
               for (const raw of [...input.lines].sort((a, b) => String(a?.itemId).localeCompare(String(b?.itemId)))) {
                    if (!raw || typeof raw.itemId !== 'string') throw new Error('Choose a delivered medicine');
                    const item = await this.item(trx, raw.itemId);
                    if (!item.is_active) throw new Error('An inactive medicine cannot be received');
                    const count = stockQuantity(raw.quantity);
                    const cost = raw.unitCost === undefined ? null : procurementAmount(raw.unitCost, 'actual purchase cost');
                    const conversion = pharmacyReceivingUnits(item, { quantity: count, unit_price: cost ?? 0, unit_type: raw.unitType, units_per_purchase_unit: raw.unitsPerPurchaseUnit });
                    if (raw.batchNumber !== undefined && (typeof raw.batchNumber !== 'string' || raw.batchNumber.trim().length > 100)) throw new Error('Enter a valid batch number');
                    const batch = raw.batchNumber?.trim() || 'AUTO-' + randomUUID().toUpperCase();
                    const expiry = raw.expiryDate ? dateOnly(raw.expiryDate) : null;
                    if (raw.condition !== undefined && !['good', 'damaged', 'expired'].includes(raw.condition)) throw new Error('Choose a valid delivery condition');
                    const condition = expiry && expiry < new Date().toISOString().slice(0, 10) ? 'expired' : raw.condition || 'good';
                    const discount = procurementAmount(raw.discountAmount ?? 0, 'line discount');
                    const tax = procurementAmount(raw.nonRecoverableTaxAmount ?? 0, 'nonrecoverable tax');
                    const total = cost === null ? null : money(new Decimal(conversion.total).minus(discount).plus(tax));
                    if (total !== null && total < 0) throw new Error('A discount cannot exceed the delivered goods value');
                    if (total !== null) procurementAmount(total, 'delivery line value');
                    if (cost === null && (discount || tax)) throw new Error('Confirm purchase cost before recording discount or tax');
                    if ((input.orderId && !raw.orderLineId) || (!input.orderId && raw.orderLineId)) throw new Error('Each ordered delivery line must belong to the selected order and medicine');
                    const orderLine = raw.orderLineId ? await trx('pharmacy_purchase_order_lines').where({ id: raw.orderLineId, order_id: order.id, item_id: item.id }).forUpdate().first() : null;
                    if ((input.orderId && !orderLine) || (!input.orderId && raw.orderLineId)) throw new Error('Each ordered delivery line must belong to the selected order and medicine');
                    let suggested = conversion.baseQuantity;
                    if (orderLine) {
                         const limit = new Decimal(orderLine.quantity_ordered).mul(new Decimal(1).plus(policy.mode === 'tolerance' ? policy.tolerancePercent / 100 : 0));
                         suggested = quantity(Math.max(0, Math.min(conversion.baseQuantity, limit.minus(orderLine.quantity_received).minus(pending.get(orderLine.id) || 0).toNumber())));
                         pending.set(orderLine.id, quantity((pending.get(orderLine.id) || 0) + suggested));
                    }
                    lines.push({ id: randomUUID(), itemId: item.id, name: item.name, sku: item.sku, orderLineId: orderLine?.id,
                         quantityDelivered: conversion.baseQuantity, purchaseQuantity: count, conversionFactor: conversion.factor,
                         unitCost: total === null ? null : new Decimal(total).div(conversion.baseQuantity).toDecimalPlaces(6).toNumber(),
                         purchaseUnitCost: cost, totalValue: total, acceptedQuantity: 0, acceptedValue: 0, returnedQuantity: 0,
                         batchNumber: batch, expiryDate: expiry, condition, suggestedAcceptance: condition === 'good' && cost !== null ? suggested : 0,
                         discountAmount: discount, nonRecoverableTaxAmount: tax, allocatedAdditionalCost: 0 });
               }
               const additional = procurementAmount(input.additionalCost ?? 0, 'additional landed cost');
               if (additional && lines.some(line => line.totalValue === null)) throw new Error('Confirm all costs before allocating additional charges');
               const totalWeight = lines.reduce((sum, line) => sum.plus(line.totalValue ?? 0), new Decimal(0));
               let allocated = 0;
               for (const [index, line] of lines.entries()) {
                    if (!additional) break;
                    const share = index === lines.length - 1 ? money(additional - allocated) : (totalWeight.gt(0) ? new Decimal(additional).mul(line.totalValue!).div(totalWeight) : new Decimal(additional).div(lines.length)).toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber();
                    allocated = money(allocated + share); line.allocatedAdditionalCost = share;
                    line.totalValue = money(new Decimal(line.totalValue!).plus(share));
                    procurementAmount(line.totalValue, 'landed line value');
                    line.unitCost = new Decimal(line.totalValue).div(line.quantityDelivered).toDecimalPlaces(6).toNumber();
               }
               const details = { schemaVersion: 2, recognition: 'grni', supplierId: supplier.id, orderId: order?.id, reference, policy, lines };
               const row = { id, branchid: this.branch, kind: 'goods_delivery', status: 'recorded', version: 1, created_by: this.actor,
                    reason: input.reason ? requiredText(input.reason, 'delivery note') : 'Supplier delivery ' + reference, details: JSON.stringify(details), created_at: new Date(), updated_at: new Date() };
               await trx('pharmacy_workflows').insert(row);
               await trx('pharmacy_documents').insert({ id: randomUUID(), branchid: this.branch, kind: 'delivery', request_key: documentKey, request_hash: fingerprint(input),
                    supplier_id: supplier.id, amount: 0, details: JSON.stringify({ deliveryId: id, reference }), created_by: this.actor, created_at: new Date() });
               await this.event(trx, 'delivery_recorded', { reference, lines }, id);
               return { ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString(), details };
          });
     }
     async accept(id: string, input: AcceptanceInput) {
          distinctLines(input.lines);
          return this.atomic(input, 'delivery_accept:' + id, async trx => {
               const row = await this.workflow(trx, id, 'goods_delivery'); this.version(row, input);
               const lines: DeliveryLine[] = row.details.lines;
               const policy: ReceivingPolicy = row.details.policy;
               await assertPharmacyDayOpen(trx, this.branch);
               const order = row.details.orderId ? await trx('pharmacy_purchase_orders').where({ id: row.details.orderId, branchid: this.branch }).forUpdate().first() : null;
               if (row.details.orderId && (!order || order.status === 'cancelled')) throw new Error('This delivery order is no longer available');
               const orderLines: Array<{ id: string; item_id: string; quantity_received: number; quantity_ordered: number; unit_cost: number }> = order ? await trx('pharmacy_purchase_order_lines').where({ order_id: order.id }).orderBy('id').forUpdate() : [];
               const source = randomUUID(), accepted = new Map<string, { quantity: Decimal; value: Decimal; item: Awaited<ReturnType<PharmacyEnterpriseCore['item']>> }>();
               let value = new Decimal(0);
               for (const selected of [...input.lines].sort((a, b) => {
                    const left = lines.find(line => line.id === a.lineId), right = lines.find(line => line.id === b.lineId);
                    return String(left?.itemId).localeCompare(String(right?.itemId)) || a.lineId.localeCompare(b.lineId);
               })) {
                    const line = lines.find(candidate => candidate.id === selected.lineId);
                    if (!line) throw new Error('Delivery line not found');
                    const count = stockQuantity(selected.quantity);
                    if (count > quantity(line.quantityDelivered - line.acceptedQuantity - line.returnedQuantity)) throw new Error('Acceptance exceeds the remaining physically held quantity');
                    if (line.condition !== 'good') throw new Error('Damaged or expired delivery goods cannot be accepted into usable stock');
                    if (selected.unitCost !== undefined) {
                         if (line.acceptedQuantity || line.unitCost !== null) throw new Error('Confirmed delivery costs cannot be overwritten');
                         line.unitCost = procurementAmount(selected.unitCost, 'actual base-unit cost');
                         line.totalValue = money(new Decimal(line.unitCost).mul(line.quantityDelivered));
                    }
                    if (line.unitCost === null || line.totalValue === null) throw new Error('Confirm the actual purchase cost before accepting stock');
                    const orderLine = line.orderLineId ? orderLines.find(candidate => candidate.id === line.orderLineId && candidate.item_id === line.itemId) : null;
                    if (line.orderLineId && !orderLine) throw new Error('Order line does not belong to this delivery');
                    if (orderLine) {
                         const next = new Decimal(orderLine.quantity_received).plus(count);
                         const limit = new Decimal(orderLine.quantity_ordered).mul(new Decimal(1).plus(policy.mode === 'tolerance' ? policy.tolerancePercent / 100 : 0));
                         if (next.gt(limit)) {
                              if (policy.mode === 'prohibit') throw new Error('This order prohibits acceptance of excess delivery; return the excess');
                              requireManager(this.user);
                              if (input.excessApproved !== true) throw new Error('Explicit manager approval is required for excess acceptance');
                              requiredText(input.reason, 'excess acceptance reason');
                         }
                         if (Number(orderLine.unit_cost) !== line.unitCost) requiredText(input.reason, 'ordered versus actual cost difference');
                         orderLine.quantity_received = quantity(next.toNumber());
                    }
                    const item = await this.item(trx, line.itemId);
                    if (!item.is_active) throw new Error('An inactive medicine cannot be accepted');
                    await assertNoStockCount(trx, item.id);
                    await assertBatchNotRecalled(trx, this.branch, item.id, line.batchNumber);
                    validatePharmacyReceipt({ ...item, inventory_domain: 'pharmacy' }, { batch_number: line.batchNumber, expiry_date: line.expiryDate });
                    if (line.expiryDate && dateOnly(line.expiryDate) < new Date().toISOString().slice(0, 10)) throw new Error('Expired delivery stock cannot be accepted');
                    const previousBatch = await trx('pharmacy_stock_movements').where({ branchid: this.branch, item_id: item.id, batch_number: line.batchNumber }).first();
                    if (previousBatch && (previousBatch.expiry_date ? dateOnly(previousBatch.expiry_date) : null) !== line.expiryDate) throw new Error('The manufacturer batch has a different recorded expiry date');
                    const newAccepted = quantity(line.acceptedQuantity + count);
                    const targetValue = money(new Decimal(line.totalValue).mul(newAccepted).div(line.quantityDelivered));
                    const deltaValue = money(new Decimal(targetValue).minus(line.acceptedValue));
                    const before = Number(item.current_stock), after = quantity(before + count);
                    await this.move(trx, item, count, line.batchNumber, line.expiryDate, 'Accepted delivery ' + row.details.reference, source, line.unitCost);
                    await trx('pharmacy_stock_movements').where({ reference_id: source, item_id: item.id, batch_number: line.batchNumber, previous_stock: before }).update({ total_cost: deltaValue });
                    const average = new Decimal(before).mul(item.cost_price || 0).plus(deltaValue).div(after).toDecimalPlaces(6).toNumber();
                    await trx('pharmacy_inventory_items').where({ id: item.id, branchid: this.branch }).update({ cost_price: average });
                    item.cost_price = average;
                    const summary = accepted.get(item.id) || { quantity: new Decimal(0), value: new Decimal(0), item };
                    summary.quantity = summary.quantity.plus(count); summary.value = summary.value.plus(deltaValue); summary.item = item; accepted.set(item.id, summary);
                    line.acceptedQuantity = newAccepted; line.acceptedValue = targetValue; value = value.plus(deltaValue);
                    line.suggestedAcceptance = quantity(Math.max(0, line.suggestedAcceptance - count));
               }
               if (input.pricing !== undefined) {
                    if (!Array.isArray(input.pricing) || new Set(input.pricing.map(price => price.itemId)).size !== input.pricing.length) throw new Error('Choose one price decision per medicine');
                    for (const choice of input.pricing) {
                         const summary = accepted.get(choice.itemId);
                         if (!summary) throw new Error('Prices can only change for medicines accepted in this operation');
                         const cost = summary.value.div(summary.quantity).toNumber();
                         const retail = calculatePharmacyPrice(cost, choice, policy.roundingIncrement);
                         const wholesale = calculatePharmacyPrice(cost, choice.wholesale || { method: 'keep' }, policy.roundingIncrement);
                         if (retail.price === null && wholesale.price === null) continue;
                         requireManager(this.user);
                         if ((retail.price !== null && choice.expectedPrice !== retail.price) ||
                              (wholesale.price !== null && choice.wholesale?.expectedPrice !== wholesale.price))
                              throw new Error('Preview the proposed selling prices again before confirming this acceptance');
                         const previous = { sale_price: Number(summary.item.sale_price || 0), wholesale_price: Number(summary.item.wholesale_price || 0) };
                         const next = { sale_price: retail.price ?? previous.sale_price, wholesale_price: wholesale.price ?? previous.wholesale_price };
                         await trx('pharmacy_inventory_items').where({ id: choice.itemId, branchid: this.branch }).update(next);
                         await trx('pharmacy_price_history').insert({ id: randomUUID(), branchid: this.branch, item_id: choice.itemId, source_id: source,
                              previous_values: JSON.stringify(previous), new_values: JSON.stringify(next), calculation: JSON.stringify({ retail, wholesale, deliveryId: id }),
                              changed_by: this.actor, effective_at: new Date() });
                    }
               }
               procurementAmount(money(value), 'accepted delivery value');
               if (value.gt(0)) await postPharmacyJournal(trx, this.branch, source, 'goods_acceptance', 'Accepted delivery ' + row.details.reference, this.actor,
                    [{ account: 'inventory', debit: money(value) }, { account: 'liability:grni', credit: money(value) }]);
               if (order) {
                    for (const line of orderLines) await trx('pharmacy_purchase_order_lines').where({ id: line.id }).update({ quantity_received: line.quantity_received });
                    await trx('pharmacy_purchase_orders').where({ id: order.id }).update({ status: orderLines.every(line => Number(line.quantity_received) >= Number(line.quantity_ordered)) ? 'received' : 'partially_received' });
               }
               const status = await this.status(trx, row, disposition(lines), { ...row.details, lines });
               await this.event(trx, 'delivery_accepted', { source, value: money(value), lines: input.lines, excessApproved: input.excessApproved === true, reason: input.reason || null }, id);
               return { ...status, details: { ...row.details, lines }, acceptanceId: source, amount: money(value) };
          });
     }
     async returnHeld(id: string, input: { idempotencyKey: string; expectedVersion: number; reason: string; lines: Array<{ lineId: string; quantity: number }> }) {
          requireManager(this.user); distinctLines(input.lines);
          const reason = requiredText(input.reason, 'supplier return evidence');
          return this.atomic(input, 'delivery_return:' + id, async trx => {
               const row = await this.workflow(trx, id, 'goods_delivery'); this.version(row, input);
               const lines: DeliveryLine[] = row.details.lines;
               for (const selected of input.lines) {
                    const line = lines.find(candidate => candidate.id === selected.lineId), count = stockQuantity(selected.quantity);
                    if (!line || count > quantity(line.quantityDelivered - line.acceptedQuantity - line.returnedQuantity)) throw new Error('Return exceeds the unaccepted quantity held');
                    line.returnedQuantity = quantity(line.returnedQuantity + count);
               }
               await this.event(trx, 'held_delivery_returned', { lines: input.lines, reason }, id);
               const result = await this.status(trx, row, disposition(lines), { ...row.details, lines });
               return { ...result, details: { ...row.details, lines } };
          });
     }
}
