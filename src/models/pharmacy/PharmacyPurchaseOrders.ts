import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { PharmacyEnterpriseCore, json, requireManager, requiredText, stockQuantity } from './PharmacyEnterpriseCore';
import { procurementAmount } from './PharmacyPricing';
import { roleAllowed } from '../../middleware/roles';

interface OrderLineInput { itemId: string; quantity: number; unitCost?: number | null }
interface CreateOrderInput { idempotencyKey: string; supplierId: string; notes?: string; submit?: boolean; lines: OrderLineInput[] }
interface DecisionInput { idempotencyKey: string; expectedVersion: number; decision: 'approve' | 'reject'; reason?: string; adminSelfReview?: boolean }
interface CancelOrderInput { idempotencyKey: string; expectedVersion?: number; reason: string }
export class PharmacyPurchaseOrders extends PharmacyEnterpriseCore {
     declare readonly db: Knex;
     private assertRead() {
          if (!roleAllowed(this.user.role, ['admin', 'pharmacy_manager', 'pharmacy_storekeeper', 'pharmacy_accountant']))
               throw new Error('Pharmacy purchasing access is required');
     }
     private async contents(trx: Knex.Transaction, input: CreateOrderInput) {
          if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100 ||
               input.lines.some(line => !line || typeof line.itemId !== 'string') || new Set(input.lines.map(line => line.itemId)).size !== input.lines.length)
               throw new Error('Choose 1 to 100 distinct medicines');
          const supplier = await trx('pharmacy_suppliers').where({ id: input.supplierId, branchid: this.branch, is_active: true }).forUpdate().first();
          if (!supplier) throw new Error('Select an active pharmacy supplier');
          if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.trim().length > 500)) throw new Error('Notes must contain at most 500 characters');
          const notes = input.notes?.trim() || '', lines = [];
          let total = new Decimal(0);
          for (const selected of [...input.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
               const item = await this.item(trx, selected.itemId);
               if (!item.is_active) throw new Error('An ordered medicine is inactive');
               const count = stockQuantity(selected.quantity), unitCost = selected.unitCost == null ? null : procurementAmount(selected.unitCost, 'estimated base-unit purchase cost');
               if (unitCost !== null) total = total.plus(new Decimal(count).mul(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
               lines.push({ itemId: item.id, name: item.name, sku: item.sku, unit: item.consumption_unit, quantity: count, unitCost });
          }
          return { schemaVersion: 4, supplierId: supplier.id, supplierName: supplier.name, notes, lines,
               total: lines.every(line => line.unitCost !== null) ? procurementAmount(total.toNumber(), 'order total') : null };
     }
     async create(input: CreateOrderInput) {
          if (!roleAllowed(this.user.role, ['admin', 'pharmacy_manager', 'pharmacy_storekeeper']))
               throw new Error('Pharmacy stock access is required');
          return this.atomic(input, 'supplier_order:create', async (trx: Knex.Transaction) => {
               if (input.submit !== undefined && typeof input.submit !== 'boolean') throw new Error('Choose draft or submit for approval');
               const contents = await this.contents(trx, input);
               const year = new Date().getUTCFullYear();
               await trx('pharmacy_order_sequences').insert({ branchid: this.branch, year, last_number: 0 }).onConflict(['branchid', 'year']).ignore();
               const sequence = await trx('pharmacy_order_sequences').where({ branchid: this.branch, year }).forUpdate().first();
               const next = Number(sequence.last_number) + 1;
               await trx('pharmacy_order_sequences').where({ branchid: this.branch, year }).update({ last_number: next });
               const id = randomUUID(), reference = `PO-${year}-${String(next).padStart(6, '0')}`, status = input.submit ? 'submitted' : 'draft';
               const details = { ...contents, reference };
               await trx('pharmacy_workflows').insert({ id, branchid: this.branch, kind: 'supplier_purchase_order', status, version: 1,
                    created_by: this.actor, reason: contents.notes || 'Routine stock replenishment', details: JSON.stringify(details), created_at: new Date(), updated_at: new Date() });
               await this.event(trx, 'supplier_order_created', { reference, status, total: details.total }, id);
               return { id, reference, status, version: 1 };
          });
     }
     async update(id: string, input: CreateOrderInput & { expectedVersion: number }) {
          if (!roleAllowed(this.user.role, ['admin', 'pharmacy_manager', 'pharmacy_storekeeper'])) throw new Error('Pharmacy stock access is required');
          return this.atomic(input, `supplier_order:update:${id}`, async trx => {
               const row = await this.workflow(trx, id, 'supplier_purchase_order'); this.version(row, input);
               if (row.status !== 'draft') throw new Error('Only a draft order can be edited');
               if (input.submit !== undefined && typeof input.submit !== 'boolean') throw new Error('Choose draft or submit for approval');
               const contents = await this.contents(trx, input);
               const status = input.submit ? 'submitted' : 'draft';
               const details = { ...contents, reference: row.details.reference, ...(input.submit ? { submittedBy: this.actor, submittedAt: new Date().toISOString() } : {}) };
               await this.event(trx, 'supplier_order_edited', { previous: row.details, next: details }, id);
               return { ...await this.status(trx, row, status, details), reference: details.reference };
          });
     }
     async submit(id: string, input: { idempotencyKey: string; expectedVersion: number }) {
          if (!roleAllowed(this.user.role, ['admin', 'pharmacy_manager', 'pharmacy_storekeeper'])) throw new Error('Pharmacy stock access is required');
          return this.atomic(input, `supplier_order:submit:${id}`, async trx => {
               const row = await this.workflow(trx, id, 'supplier_purchase_order'); this.version(row, input);
               if (row.status !== 'draft') throw new Error('Only a draft order can be submitted');
               return this.status(trx, row, 'submitted', { ...row.details, submittedBy: this.actor, submittedAt: new Date().toISOString() });
          });
     }
     async decide(id: string, input: DecisionInput) {
          requireManager(this.user);
          return this.atomic(input, `supplier_order:decision:${id}`, async trx => {
               const row = await this.workflow(trx, id, 'supplier_purchase_order'); this.version(row, input);
               if (row.status !== 'submitted') throw new Error('Only a submitted order can be reviewed');
               if (!['approve', 'reject'].includes(input.decision)) throw new Error('Choose approve or reject');
               const own = [row.created_by, row.details.submittedBy].some(actor => Number(actor) === this.actor);
               if (own && !roleAllowed(this.user.role, ['admin'])) throw new Error('A different manager or administrator must review this order');
               const reason = input.reason?.trim() || (input.decision === 'approve' && !own ? 'Routine purchase approval' : '');
               if (own && (input.adminSelfReview !== true || reason.length < 10)) throw new Error('Confirm administrator self-review and provide an audit reason of at least 10 characters');
               requiredText(reason, 'review reason', 500);
               if (input.decision === 'approve') {
                    if (!await trx('pharmacy_suppliers').where({ id: row.details.supplierId, branchid: this.branch, is_active: true }).first())
                         throw new Error('The selected supplier is unavailable');
                    for (const line of row.details.lines) if (!(await this.item(trx, line.itemId)).is_active) throw new Error('An ordered medicine is inactive');
                    await trx('pharmacy_purchase_orders').insert({ id, branchid: this.branch, supplier_id: row.details.supplierId, status: 'ordered',
                         total_amount: row.details.total, created_by: row.created_by, notes: row.details.notes || null, created_at: row.created_at });
                    await trx('pharmacy_purchase_order_lines').insert(row.details.lines.map((line: OrderLineInput) => ({
                         id: randomUUID(), order_id: id, item_id: line.itemId, quantity_ordered: line.quantity, quantity_received: 0, unit_cost: line.unitCost })));
                    if (row.details.total != null) await trx('pharmacy_documents').insert({ id: randomUUID(), branchid: this.branch, kind: 'purchase_order', request_key: `supplier-order:${id}`, request_hash: id,
                         supplier_id: row.details.supplierId, amount: row.details.total, details: JSON.stringify({ ...row.details, orderId: id }), created_by: this.actor, created_at: new Date() });
               }
               await trx('pharmacy_workflows').where({ id }).update({ reviewed_by: this.actor });
               await this.event(trx, own ? 'supplier_order_admin_self_review' : 'supplier_order_review', { decision: input.decision, reason, requestedBy: row.created_by }, id);
               return this.status(trx, row, input.decision === 'approve' ? 'approved' : 'rejected',
                    { ...row.details, reviewedBy: this.actor, reviewedAt: new Date().toISOString(), decisionReason: reason, adminSelfReview: own });
          });
     }
     async cancel(id: string, input: CancelOrderInput) {
          requireManager(this.user);
          const reason = requiredText(input.reason, 'cancellation reason', 500);
          if (reason.length < 5) throw new Error('Enter a cancellation reason of at least 5 characters');
          return this.atomic(input, `supplier_order:cancel:${id}`, async trx => {
               const workflow = await trx('pharmacy_workflows')
                    .where({ id, branchid: this.branch, kind: 'supplier_purchase_order' }).forUpdate().first();
               const order = await trx('pharmacy_purchase_orders')
                    .where({ id, branchid: this.branch }).forUpdate().first();
               if (!workflow && !order) throw new Error('Purchase order not found in this branch');
               if (workflow) this.version(workflow, input);
               const currentStatus = workflow?.status || order?.status;
               if (!currentStatus) throw new Error('Purchase order status is unavailable');
               if (['cancelled', 'rejected', 'received'].includes(currentStatus) || order?.status === 'received')
                    throw new Error('This purchase order is already closed and cannot be cancelled');
               const deliveries = await trx('pharmacy_workflows')
                    .where({ branchid: this.branch, kind: 'goods_delivery' });
               const hasUnresolvedDelivery = deliveries
                    .map(row => ({ ...row, details: json(row.details) }))
                    .filter(row => row.details.orderId === id)
                    .some(row => (row.details.lines || []).some((line: { quantityDelivered?: number; acceptedQuantity?: number; returnedQuantity?: number }) =>
                         new Decimal(line.quantityDelivered || 0).minus(line.acceptedQuantity || 0).minus(line.returnedQuantity || 0).gt(0)));
               if (hasUnresolvedDelivery) throw new Error('Resolve all held or unaccepted delivery quantities before closing this order');
               if (order) await trx('pharmacy_purchase_orders').where({ id, branchid: this.branch }).update({ status: 'cancelled' });
               if (workflow) await this.status(trx, { ...workflow, details: json(workflow.details) }, 'cancelled', {
                    ...json(workflow.details), cancellationReason: reason, cancelledBy: this.actor, cancelledAt: new Date().toISOString(),
               });
               await this.event(trx, 'supplier_order_cancelled', { reason, previousStatus: currentStatus }, id);
               return { id, status: 'cancelled', ...(workflow ? { version: Number(workflow.version) + 1 } : {}) };
          });
     }
     async list() {
          this.assertRead();
          return this.db.transaction(async trx => {
               const [workflows, orders, suppliers] = await Promise.all([
                    trx('pharmacy_workflows').where({ branchid: this.branch, kind: 'supplier_purchase_order' }).orderBy('created_at', 'desc').limit(200),
                    trx('pharmacy_purchase_orders').where({ branchid: this.branch }).orderBy('created_at', 'desc').limit(200),
                    trx('pharmacy_suppliers').where({ branchid: this.branch }),
               ]);
               const managed = new Map(workflows.map(row => [row.id, { ...row, details: json(row.details) }]));
               const identities = orders.length ? await trx('pharmacy_workflows').where({ branchid: this.branch, kind: 'supplier_purchase_order' }).whereIn('id', orders.map(row => row.id)) : [];
               const references = new Map(identities.map(row => [row.id, json(row.details).reference]));
               const rows = [...workflows.map(row => {
                    const details = json(row.details);
                    const operationalStatus = orders.find(order => order.id === row.id)?.status;
                    const status = operationalStatus && ['partially_received', 'received', 'cancelled'].includes(operationalStatus) ? operationalStatus : row.status;
                    return { id: row.id, reference: details.reference, supplierId: details.supplierId, supplierName: details.supplierName, status, createdAt: row.created_at, total: details.total, itemCount: details.lines.length };
               }), ...orders.filter(row => !managed.has(row.id)).map(row => ({
                    id: row.id, reference: references.get(row.id) || `PO-${row.id.slice(0, 8).toUpperCase()}`, supplierId: row.supplier_id,
                    supplierName: suppliers.find(supplier => supplier.id === row.supplier_id)?.name || 'Archived supplier',
                    status: row.status, createdAt: row.created_at, total: row.total_amount,
               }))];
               return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
     }
     async detail(id: string) {
          this.assertRead();
          return this.db.transaction(async trx => {
               const workflow = await trx('pharmacy_workflows').where({ id, branchid: this.branch, kind: 'supplier_purchase_order' }).first();
               const order = await trx('pharmacy_purchase_orders').where({ id, branchid: this.branch }).first();
               if (!workflow && !order) throw new Error('Purchase order not found in this branch');
               const details = workflow ? json(workflow.details) : null, supplierId = details?.supplierId || order.supplier_id;
               const supplier = await trx('pharmacy_suppliers').where({ id: supplierId, branchid: this.branch }).first();
               const storedLines = order ? await trx('pharmacy_purchase_order_lines as l').join('pharmacy_inventory_items as i', 'i.id', 'l.item_id')
                    .where('l.order_id', id).select('l.*', 'i.name', 'i.sku', 'i.consumption_unit', 'i.sale_price') : [];
               const lines = order ? storedLines.map(line => ({ id: line.id, itemId: line.item_id, name: line.name, sku: line.sku, unit: line.consumption_unit,
                    quantity: Number(line.quantity_ordered), accepted: Number(line.quantity_received), unitCost: line.unit_cost == null ? null : Number(line.unit_cost), salePrice: Number(line.sale_price) })) :
                    details.lines.map((line: OrderLineInput) => ({ ...line, accepted: 0 }));
               // Do not cap related evidence: older partial deliveries must remain visible.
               const physical = (await trx('pharmacy_workflows').where({ branchid: this.branch, kind: 'goods_delivery' })).map(row => ({ ...row, details: json(row.details) })).filter(row => row.details.orderId === id);
               const legacy = (await trx('pharmacy_documents').where({ branchid: this.branch, kind: 'receipt' })).map(row => ({ ...row, details: json(row.details) })).filter(row => row.details.orderId === id);
               const deliveryIds = new Set(physical.map(row => row.id)), legacyIds = new Set(legacy.map(row => row.id));
               const finance = roleAllowed(this.user.role, ['admin', 'pharmacy_manager', 'pharmacy_accountant']);
               const invoiceDocuments = finance ? (await trx('pharmacy_documents').where({ branchid: this.branch, kind: 'supplier_invoice', supplier_id: supplierId }))
                    .map(row => ({ ...row, details: json(row.details) })).filter(row => row.details.lines?.some((line: { deliveryId: string }) => deliveryIds.has(line.deliveryId))) : [];
               const sourceIds = [...invoiceDocuments.map(row => row.id), ...legacyIds];
               const bills = finance && sourceIds.length ? await trx('pharmacy_accounting_bills').where({ branchid: this.branch }).whereIn('source_ref', sourceIds) : [];
               const billIds = new Set(bills.map(row => row.id));
               const allocations = billIds.size ? await trx('pharmacy_accounting_allocations').where({ branchid: this.branch }).whereIn('bill_id', [...billIds]) : [];
               const settlements = billIds.size ? (await trx('pharmacy_accounting_documents').where({ branchid: this.branch, kind: 'ap_settlement' }))
                    .map(row => ({ ...row, details: json(row.details) })).filter(row => row.details.allocations?.some((line: { billId: string }) => billIds.has(line.billId))) : [];
               const billRows = bills.map(row => {
                    const paid = allocations.filter(line => line.bill_id === row.id).reduce((sum, line) => sum.plus(line.amount), new Decimal(0));
                    return { ...row, supplier_name: supplier?.name, allocated_amount: paid.toFixed(2), outstanding_amount: new Decimal(row.amount).minus(paid).toFixed(2) };
               });
               const delivered = lines.some(line => line.accepted > 0) || physical.length > 0 || legacy.length > 0;
               const fullyDelivered = lines.every(line => Math.max(line.accepted, physical.flatMap(row => row.details.lines)
                    .filter(batch => batch.itemId === line.itemId).reduce((sum, batch) => sum + Number(batch.quantityDelivered), 0)) >= line.quantity);
               const acceptedComplete = lines.every(line => line.accepted >= line.quantity);
               const held = physical.some(row => row.details.lines.some((line: { quantityDelivered: number; acceptedQuantity: number; returnedQuantity: number }) =>
                    new Decimal(line.quantityDelivered).minus(line.acceptedQuantity).minus(line.returnedQuantity).gt(0)));
               const uninvoiced = physical.some(row => row.details.lines.some((line: { acceptedQuantity: number; invoiceQuantity?: number }) =>
                    new Decimal(line.acceptedQuantity).gt(line.invoiceQuantity || 0)));
               const total = billRows.reduce((sum, bill) => sum.plus(bill.amount), new Decimal(0)), paid = billRows.reduce((sum, bill) => sum.plus(bill.allocated_amount), new Decimal(0));
               const approved = !!order && order.status !== 'cancelled';
               const stages = [
                    { id: 'details', label: 'Created', state: 'complete' },
                    { id: 'approval', label: workflow?.status === 'rejected' ? 'Rejected' : 'Approved', state: approved ? 'complete' : workflow?.status === 'rejected' ? 'blocked' : 'active' },
                    { id: 'receiving', label: delivered && !fullyDelivered ? 'Partially received' : 'Receiving', state: fullyDelivered && delivered ? 'complete' : delivered || approved ? 'active' : 'pending' },
                    { id: 'stock', label: held ? 'Goods on hold' : !acceptedComplete && lines.some(line => line.accepted > 0) ? 'Partially stocked' : 'Stock updated', state: acceptedComplete && !held ? 'complete' : delivered ? 'active' : 'pending' },
                    { id: 'invoices', label: uninvoiced && billRows.length ? 'Partially invoiced' : 'Invoice recorded', state: !finance ? 'restricted' : acceptedComplete && !uninvoiced && billRows.length ? 'complete' : billRows.length || uninvoiced ? 'active' : 'pending' },
                    { id: 'payments', label: paid.gt(0) && paid.lt(total) ? 'Partially paid' : paid.gt(0) && paid.eq(total) ? 'Paid to date' : 'Payment', state: !finance ? 'restricted' : acceptedComplete && !held && !uninvoiced && total.gt(0) && paid.eq(total) ? 'complete' : billRows.length ? 'active' : 'pending' },
               ];
               const events = await trx('pharmacy_enterprise_events').where({ branchid: this.branch }).whereIn('workflow_id', [id, ...deliveryIds, ...invoiceDocuments.map(row => row.id)]).orderBy('created_at');
               const financialIds = [...billIds, ...settlements.map(row => row.id), ...allocations.map(row => row.document_id)];
               const financialEvents = finance && financialIds.length ? await trx('pharmacy_accounting_audit').where({ branchid: this.branch }).whereIn('entity_id', financialIds) : [];
               const history = [...events.map(row => ({ ...row, details: json(row.details) })),
                    ...financialEvents.map(row => ({ id: `accounting:${row.id}`, action: row.action, actor_id: row.actor_id, created_at: row.created_at, details: json(row.after_state) }))]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
               const status = order?.status === 'cancelled' || order?.status === 'received' || order?.status === 'partially_received'
                    ? order.status : workflow?.status || order?.status;
               if (!status) throw new Error('Purchase order status is unavailable');
               return { id, reference: details?.reference || `PO-${id.slice(0, 8).toUpperCase()}`, supplierId, supplierName: supplier?.name || details?.supplierName || 'Archived supplier',
                    supplierEmail: supplier?.email || '', supplierPhone: supplier?.phone || '',
                    createdAt: workflow?.created_at || order.created_at, createdBy: workflow?.created_by || order.created_by, submittedBy: details?.submittedBy,
                    version: workflow?.version, status, managed: !!workflow,
                    notes: details?.notes || order?.notes || '', total: details ? details.total : order.total_amount == null ? null : Number(order.total_amount), lines, stages, deliveries: physical, legacyReceipts: legacy,
                    invoices: invoiceDocuments, bills: billRows, settlements, allocations, events: history,
                    financial: finance ? { amount: total.toFixed(2), paid: paid.toFixed(2), outstanding: total.minus(paid).toFixed(2) } : null,
                    canReceive: approved && roleAllowed(this.user.role, ['admin', 'pharmacy_manager', 'pharmacy_storekeeper']) };
          });
     }
}
