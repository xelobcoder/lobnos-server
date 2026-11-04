import KnexConnection from '../../database/KnexConnections';
import BillingStrategy from '../clincians/billingstrategy';
import { EntityOrderListFilters, EntityOrderRepository } from './EntityOrderRepository';
import {
     CreateEntityOrderInput,
     EntityOrderEntityType,
     EntityOrderLineInput,
     EntityOrderStatus,
} from './EntityOrder.types';

const BILLING_SOURCE: Record<EntityOrderEntityType, number> = {
     general: 1,
     organization: 2,
     clinician: 6,
};


export class EntityOrderService {
     private repo: EntityOrderRepository;
     private strategy: BillingStrategy;

     constructor(private tenantId: number) {
          this.repo = new EntityOrderRepository(tenantId);
          this.strategy = new BillingStrategy();
     }


     async getCatalogueForEntity(entityType: EntityOrderEntityType, entityId: number | null, search?: string) {
          const type: EntityOrderEntityType = entityType || 'general';
          const id = type === 'general' ? 0 : Number(entityId || 0);

          let hasStrategy = false;
          if (type !== 'general' && id) {
               hasStrategy = await this.strategy.entityHasStrategy(this.tenantId, type, id);
          }

          let catalogue = await this.strategy.getProvidentialBillingHandler(
               this.tenantId,
               type === 'general' ? 'general' : type,
               id,
               true
          );

          if (typeof catalogue === 'string') catalogue = [];

          let items = (catalogue as any[]).map((t: any) => ({
               testid: t.testid ?? t.id,
               name: t.name,
               price: Number(t.discountedValue ?? t.price ?? 0),
               originalPrice: Number(t.originalPrice ?? t.price ?? 0),
               strategyPriced: hasStrategy && Number(t.discountedValue) !== Number(t.originalPrice ?? t.price) ? 1 : 0,
          }));

          if (search && search.trim()) {
               const term = search.trim().toLowerCase();
               items = items.filter((i) => i.name?.toLowerCase().includes(term));
          }

          return { hasStrategy, billingSource: BILLING_SOURCE[type], items };
     }


     private async resolveEntity(input: CreateEntityOrderInput): Promise<{ type: EntityOrderEntityType; id: number | null }> {
          if (input.entityType && input.entityType !== 'general' && input.entityId) {
               return { type: input.entityType, id: Number(input.entityId) };
          }
          const conn = await KnexConnection(this.tenantId);
          const clinician = await conn('clinicianbasicinfo').where({ id: input.orderedByEmployeeId }).first();
          if (clinician) return { type: 'clinician', id: clinician.id };
          return { type: input.entityType || 'general', id: input.entityId ? Number(input.entityId) : null };
     }


     async createOrder(input: CreateEntityOrderInput) {
          const { patientId, orderedByEmployeeId, consultationId, branchId, sampleLocation, notes, lines } = input;
          if (!patientId) throw new Error('patientId is required');
          if (!orderedByEmployeeId) throw new Error('orderedByEmployeeId is required');
          if (!Array.isArray(lines) || lines.length === 0) throw new Error('At least one test is required');

          const { type, id } = await this.resolveEntity(input);

          const resolvedLines = await this.resolveLines(type, id, lines);

          const orderId = await this.repo.createOrder(
               {
                    patient_id: patientId,
                    request_key: input.requestKey || null,
                    consultation_id: consultationId ?? null,
                    ordered_by_employee_id: orderedByEmployeeId,
                    entity_type: type,
                    entity_id: id,
                    billing_source: BILLING_SOURCE[type],
                    strategy_id: null,
                    status: 'DRAFT',
                    revision: 1,
                    sample_location: sampleLocation ?? 'center',
                    notes: notes ?? null,
                    branch_id: branchId ?? null,
               },
               resolvedLines
          );

          await this.repo.recordDecision(orderId, 1, 'submit', orderedByEmployeeId, 'Order created');
          return this.repo.getOrderById(orderId);
     }


     private async resolveLines(entityType: EntityOrderEntityType, entityId: number | null, lines: EntityOrderLineInput[]) {
          const conn = await KnexConnection(this.tenantId);
          const resolved: any[] = [];
          const hasStrategy = entityType !== 'general' && entityId
               ? await this.strategy.entityHasStrategy(this.tenantId, entityType, entityId)
               : false;

          for (const line of lines) {
               const testId = Number(line.testId);
               const test = await conn('test_panels').where({ id: testId }).first();
               if (!test) throw new Error(`Test ${testId} not found`);

               const unitPrice = await this.strategy.getProvidentialTestPrice(
                    this.tenantId,
                    entityType === 'general' ? 'general' : entityType,
                    entityId || 0,
                    testId,
                    true
               );

               const strategyPriced = hasStrategy && Number(unitPrice) !== Number(test.price) ? 1 : 0;

               resolved.push({
                    test_id: testId,
                    test_name: test.name,
                    unit_price: Number(unitPrice),
                    strategy_priced: strategyPriced,
                    quantity: Math.max(1, Number(line.quantity || 1)),
               });
          }
          return resolved;
     }

     async getOrder(orderId: number) {
          const order = await this.repo.getOrderById(orderId);
          if (!order) throw new Error('Order not found');
          return order;
     }

     async listOrders(filters: EntityOrderListFilters) {
          return this.repo.listOrders(filters);
     }

     async summarizeOrders(filters: EntityOrderListFilters) {
          return this.repo.summarizeOrders(filters);
     }

     /** Backfills orders placed before a consultation existed (consultation_id was still null) once it is saved. */
     async filterOrderIdsForClinician(orderIds: number[], clinicianId: number): Promise<number[]> {
          return this.repo.filterOrderIdsForClinician(orderIds, clinicianId);
     }

     async linkOrdersToConsultation(orderIds: number[], patientId: number, consultationId: number): Promise<number> {
          return this.repo.linkOrdersToConsultation(orderIds, patientId, consultationId);
     }


     async submit(orderId: number, actorId: number) {
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status !== 'DRAFT') throw new Error(`Only DRAFT orders can be submitted (current: ${order.status})`);
          await this.repo.updateOrder(orderId, { status: 'PENDING' });
          await this.repo.recordDecision(orderId, order.revision, 'submit', actorId);
          return this.getOrder(orderId);
     }


     async approve(orderId: number, actorId: number, reason?: string) {
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status !== 'PENDING' && order.status !== 'ON_HOLD') {
               throw new Error(`Only PENDING or ON_HOLD orders can be approved (current: ${order.status})`);
          }
          await this.repo.updateOrder(orderId, { status: 'APPROVED', decided_by: actorId, decided_at: new Date(), decision_reason: reason ?? null });
          await this.repo.recordDecision(orderId, order.revision, 'approve', actorId, reason);
          return this.getOrder(orderId);
     }


     async hold(orderId: number, actorId: number, reason: string) {
          if (!reason?.trim()) throw new Error('A reason is required to hold an order');
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status !== 'PENDING') throw new Error(`Only PENDING orders can be held (current: ${order.status})`);
          await this.repo.updateOrder(orderId, { status: 'ON_HOLD', decided_by: actorId, decided_at: new Date(), decision_reason: reason });
          await this.repo.recordDecision(orderId, order.revision, 'hold', actorId, reason);
          return this.getOrder(orderId);
     }


     async reject(orderId: number, actorId: number, reason: string) {
          if (!reason?.trim()) throw new Error('A reason is required to reject an order');
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status !== 'PENDING' && order.status !== 'ON_HOLD') {
               throw new Error(`Only PENDING or ON_HOLD orders can be rejected (current: ${order.status})`);
          }
          await this.repo.updateOrder(orderId, { status: 'REJECTED', decided_by: actorId, decided_at: new Date(), decision_reason: reason });
          await this.repo.recordDecision(orderId, order.revision, 'reject', actorId, reason);
          return this.getOrder(orderId);
     }


     async revise(orderId: number, actorId: number, lines: EntityOrderLineInput[]) {
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status !== 'ON_HOLD' && order.status !== 'DRAFT') {
               throw new Error(`Only ON_HOLD or DRAFT orders can be edited (current: ${order.status})`);
          }
          if (!Array.isArray(lines) || lines.length === 0) throw new Error('At least one test is required');

          const newRevision = order.revision + 1;
          const resolvedLines = await this.resolveLines(order.entity_type, order.entity_id, lines);

          const conn = await KnexConnection(this.tenantId);
          await conn.transaction(async (trx: any) => {
               await this.repo.replaceLines(orderId, resolvedLines, trx);
               await this.repo.updateOrder(orderId, { status: 'PENDING', revision: newRevision }, trx);
               await this.repo.recordDecision(orderId, newRevision, 'edit', actorId, 'Order revised and resubmitted', trx);
          });
          return this.getOrder(orderId);
     }


     async convert(orderId: number, actorId: number, reviewerBranchId?: number | null) {
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status !== 'APPROVED') {
               throw new Error(`Only APPROVED orders can be converted (current: ${order.status})`);
          }
          if (order.billing_id) throw new Error('Order has already been converted');

          const conn = await KnexConnection(this.tenantId);
          const lines = await this.repo.getOrderLines(orderId);
          if (!lines.length) throw new Error('This order has no test lines to bill');

          let branchId: number | null = (reviewerBranchId && Number(reviewerBranchId)) || order.branch_id || null;
          if (!branchId && actorId) {
               const staff = await conn('roles').where({ employeeid: actorId }).first();
               branchId = staff?.branch ? Number(staff.branch) : null;
          }
          if (!branchId) {
               const anyBranch = await conn('branch').orderBy('branchid', 'asc').first();
               branchId = anyBranch ? Number(anyBranch.branchid) : null;
          }
          if (!branchId) throw new Error('Cannot convert: no branch is configured for this tenant');

          const billingSource = order.billing_source;
          const entityType = order.entity_type;
          const entityId = order.entity_id ?? undefined;

          const { CustomerBillingCheckout } = await import('../billing/multi/customerBillingCheckout');
          const { SubmitCustomerBilling } = await import('../billing/billing-new-client-multi');

          const checkout = await (CustomerBillingCheckout as any).checkoutCustomerBilling({
               tenantId: this.tenantId,
               patientId: order.patient_id,
               cart: lines.map((l: any) => ({ testid: l.test_id, quantity: Number(l.quantity || 1), discount: 0 })),
               servicesList: [],
               paymentDetails: null,
               branchid: branchId,
               billingSource,
               entitytype: entityType,
               entityid: entityId,
               employeeid: actorId,
               isPromo: false,
               isPackageUsed: false,
          });
          if (!checkout || checkout.success === false) {
               throw new Error(checkout?.message || 'Checkout failed during conversion');
          }
          const data = checkout.data || {};
          const pricedCart = Array.isArray(data.cart) ? data.cart : [];
          if (!pricedCart.length) throw new Error('Checkout returned no billable tests for this order');

          const payload: any = {
               tenantId: this.tenantId,
               patientid: order.patient_id,
               patientId: order.patient_id,
               employeeid: actorId,
               branchid: branchId,
               branchId: branchId,
               samplingCenter: branchId,
               billingSource,
               entitytype: entityType,
               entityId,
               entityid: entityId,
               cart: pricedCart,
               servicesProvided: [],
               isPackageUsed: false,
               paid: 0,
               hasNightAdjustment: false,
               isPromo: false,
               status: 'pending',
               billeddate: new Date(),
               result_delivery: { preferences: [], employeeid: actorId },
               subtotal: data.subtotal,
               totaldiscount: data.totaldiscount,
               totalAmountIncurredDueTax: data.totalAmountIncurredDueTax,
               totalServiceAmount: data.totalServiceAmount,
               amountPayable: data.amountPayable,
          };

          const result = await new SubmitCustomerBilling(payload, this.tenantId, {
               beforeWrite: async trx => {
                    const source = await trx('entity_orders').where({ id: orderId }).forUpdate().first();
                    if (!source) throw new Error('Order not found');
                    if (source.billing_id) return Number(source.billing_id);
                    if (source.status !== 'APPROVED' || Number(source.revision) !== Number(order.revision))
                         throw new Error('Order changed; refresh before converting');
                    return null;
               },
               afterWrite: async (trx, billingId) => {
                    await this.repo.updateOrder(orderId, { status: 'CONVERTED', billing_id: billingId,
                         converted_by: actorId, converted_at: new Date() }, trx);
               }
          }).submit();
          if (!result || result.status === false || !result.billingid) {
               throw new Error(result?.message || 'Billing submission failed during conversion');
          }
          const billingId = Number(result.billingid);

          await this.repo.updateOrder(orderId, {
               status: 'CONVERTED',
               billing_id: billingId,
               converted_by: actorId,
               converted_at: new Date(),
          });
          await this.repo.recordDecision(orderId, order.revision, 'convert', actorId, null);

          return { order: await this.getOrder(orderId), billingId };
     }


     async cancel(orderId: number, actorId: number, reason?: string) {
          const order = await this.repo.getOrderRow(orderId);
          if (!order) throw new Error('Order not found');
          if (order.status === 'CONVERTED') throw new Error('Cannot cancel a converted order');
          if (order.status === 'REJECTED' || order.status === 'CANCELLED') throw new Error(`Order already ${order.status}`);
          await this.repo.updateOrder(orderId, { status: 'CANCELLED', decided_by: actorId, decided_at: new Date(), decision_reason: reason ?? null });
          await this.repo.recordDecision(orderId, order.revision, 'cancel', actorId, reason);
          return this.getOrder(orderId);
     }
}

export const createEntityOrderService = (tenantId: number) => new EntityOrderService(tenantId);
