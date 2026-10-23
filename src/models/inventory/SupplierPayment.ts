import { AuthUser } from '../../middleware/authority';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { validateSupplierPaymentFunding, SupplierPaymentValidationError } from './SupplierPaymentFunding';
import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import {
     SupplierPayment,
     CreateSupplierPaymentRequest,
     UpdateSupplierPaymentRequest,
     SupplierPaymentListResponse,
     SupplierPaymentFilters,
     SupplierPaymentAllocation,
     CreateSupplierPaymentAllocationRequest,
     SupplierPaymentSummary
} from './supplierPaymentTypes';
import KnexConnection from '../../database/KnexConnections';
import { enqueueSupplierPayment } from '../../accountingModule/integrations/SupplierAccounting';

export class SupplierPaymentModel {
     private connection: Promise<Knex<any, any[]>>;
     private tenantId: number;
     private paymentCounter: number = 0;
     private allocationCounter: number = 0;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     private generatePaymentId(): string {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const timestamp = Date.now().toString().slice(-4);
          return `PAY-${year}${month}${day}-${timestamp}`;
     }

     private generateAllocationId(): string {
          const timestamp = Date.now();
          this.allocationCounter += 1;
          return `ALLOC-${timestamp}${this.allocationCounter.toString().padStart(3, '0')}`;
     }

     async create(request: CreateSupplierPaymentRequest, actor: AuthUser): Promise<SupplierPayment> {
          const connection = await this.connection;

          // Reset counters for new payment
          this.paymentCounter = 0;
          this.allocationCounter = 0;

          // Validate supplier exists and is active
          const supplier = await connection('inv_suppliers')
               .where('id', request.supplier_id)
               .where('is_active', true)
               .first();

          if (!supplier) {
               throw new Error('Supplier not found or inactive');
          }

          // Validate purchase order exists and is received
          const purchaseOrder = await connection('inv_purchase_orders')
               .where('id', request.purchase_order_id)
               .where('status', 'received')
               .first();

          if (!purchaseOrder) {
               throw new Error('Purchase order not found or not received');
          }

          // Validate payment amount is positive
          if (!Number.isFinite(request.payment_amount) || request.payment_amount <= 0) {
               throw new Error('Payment amount must be positive');
          }

          const funding = await validateSupplierPaymentFunding(connection, actor, request.payment_account_id, request.payment_method || 'cash');
          if (purchaseOrder.supplier_id !== request.supplier_id) throw new SupplierPaymentValidationError('Purchase order does not belong to this supplier');
          const paymentId = 'PAY-' + randomUUID();
          const paymentDate = request.payment_date || new Date();

          const paymentData = {
               id: 'SP-' + randomUUID(),
               payment_account_id: funding.account.id,
               payment_account_gl_code: null,
               branchid: funding.branchid,
               payment_id: paymentId,
               supplier_id: request.supplier_id,
               purchase_order_id: request.purchase_order_id,
               payment_amount: request.payment_amount,
               payment_date: paymentDate,
               payment_method: request.payment_method || 'cash',
               payment_status: 'pending',
               reference_number: request.reference_number || null,
               payment_notes: request.payment_notes || null,
               total_allocated: 0,
               created_by: String(actor.employeeid),
               approved_by: null,
               approved_at: null,
               processed_at: null,
               created_at: new Date(),
               updated_at: new Date()
          };

          // Start transaction
          const trx = await connection.transaction();

          try {
               // Insert payment
               await trx('inv_supplier_payments').insert(paymentData);

               // Insert allocations if provided
               if (request.allocations && request.allocations.length > 0) {
                    const allocations = request.allocations.map(allocation => {
                         // Validate allocation amount
                         if (allocation.allocated_amount <= 0) {
                              throw new Error('Allocation amount must be positive');
                         }

                         // Validate purchase order item if specified
                         if (allocation.order_item_id) {
                              const orderItem = purchaseOrder.items?.find(item => item.id === allocation.order_item_id);
                              if (!orderItem) {
                                   throw new Error(`Order item ${allocation.order_item_id} not found in purchase order`);
                              }
                         }

                         return {
                              id: this.generateAllocationId(),
                              payment_id: paymentData.id,
                              purchase_order_id: request.purchase_order_id,
                              order_item_id: allocation.order_item_id || null,
                              allocated_amount: allocation.allocated_amount,
                              allocation_notes: allocation.allocation_notes || null,
                              created_at: new Date()
                         };
                    });

                    await trx('inv_supplier_payment_allocations').insert(allocations);

                    // Update total allocated amount
                    await this.updateTotalAllocated(paymentData.id, trx);
               }

               await trx.commit();

               return await this.findById(paymentData.id) as SupplierPayment;
          } catch (error) {
               await trx.rollback();
               throw error;
          }
     }

     async findById(id: string): Promise<SupplierPayment | null> {
          const connection = await this.connection;

          const result = await connection('inv_supplier_payments')
               .leftJoin('inv_suppliers', 'inv_supplier_payments.supplier_id', 'inv_suppliers.id')
               .leftJoin('payment_accounts as source_account', 'inv_supplier_payments.payment_account_id', 'source_account.id')
               .leftJoin('inv_purchase_orders', 'inv_supplier_payments.purchase_order_id', 'inv_purchase_orders.id')
               .select(
                    'inv_supplier_payments.*',
                    'source_account.name as payment_account_name',
                    'inv_suppliers.id as supplier_id_join',
                    'inv_suppliers.name as supplier_name',
                    'inv_suppliers.contact as supplier_contact',
                    'inv_suppliers.email as supplier_email',
                    'inv_purchase_orders.id as po_id_join',
                    'inv_purchase_orders.order_number as po_order_number',
                    'inv_purchase_orders.total_amount as po_total_amount',
                    'inv_purchase_orders.status as po_status'
               )
               .where('inv_supplier_payments.id', id)
               .first();

          if (!result) return null;

          // Fetch allocations for this payment
          const allocations = await this.getPaymentAllocations(id);

          // Build supplier object
          const supplier = result.supplier_id_join ? {
               id: result.supplier_id_join,
               name: result.supplier_name,
               contact: result.supplier_contact,
               email: result.supplier_email
          } : undefined;

          // Build purchase order object
          const purchase_order = result.po_id_join ? {
               id: result.po_id_join,
               order_number: result.po_order_number,
               total_amount: parseFloat(result.po_total_amount),
               status: result.po_status
          } : undefined;

          return {
               id: result.id,
               payment_id: result.payment_id,
               supplier_id: result.supplier_id,
               purchase_order_id: result.purchase_order_id,
               payment_amount: parseFloat(result.payment_amount),
               payment_date: result.payment_date,
               payment_method: result.payment_method,
               payment_account_id: result.payment_account_id,
               payment_account_name: result.payment_account_name,
               payment_account_gl_code: result.payment_account_gl_code,
               branchid: result.branchid,
               payment_status: result.payment_status,
               reference_number: result.reference_number,
               payment_notes: result.payment_notes,
               total_allocated: parseFloat(result.total_allocated),
               created_by: result.created_by,
               approved_by: result.approved_by,
               approved_at: result.approved_at,
               processed_at: result.processed_at,
               created_at: result.created_at,
               updated_at: result.updated_at,
               supplier: supplier,
               purchase_order: purchase_order,
               allocations: allocations,
               expense_synced: Boolean(result.expense_synced)
          };
     }

     async findByPaymentId(paymentId: string): Promise<SupplierPayment | null> {
          const connection = await this.connection;

          const result = await connection('inv_supplier_payments')
               .where('payment_id', paymentId)
               .first();

          if (!result) return null;

          return await this.findById(result.id);
     }

     async findMany(filters: SupplierPaymentFilters): Promise<SupplierPaymentListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               supplier_id,
               purchase_order_id,
               payment_status,
               payment_method,
               startDate,
               endDate,
               search
          } = filters;

          let query = connection('inv_supplier_payments')
               .leftJoin('inv_suppliers', 'inv_supplier_payments.supplier_id', 'inv_suppliers.id')
               .leftJoin('payment_accounts as source_account', 'inv_supplier_payments.payment_account_id', 'source_account.id')
               .leftJoin('inv_purchase_orders', 'inv_supplier_payments.purchase_order_id', 'inv_purchase_orders.id')
               .select(
                    'inv_supplier_payments.*',
                    'source_account.name as payment_account_name',
                    'inv_suppliers.name as supplier_name',
                    'inv_purchase_orders.order_number as po_order_number'
               )
               .orderBy('inv_supplier_payments.created_at', sortby);

          // Apply filters
          if (supplier_id) {
               query = query.where('inv_supplier_payments.supplier_id', supplier_id);
          }
          if (purchase_order_id) {
               query = query.where('inv_supplier_payments.purchase_order_id', purchase_order_id);
          }
          if (payment_status) {
               if (Array.isArray(payment_status)) {
                    query = query.whereIn('inv_supplier_payments.payment_status', payment_status);
               } else {
                    query = query.where('inv_supplier_payments.payment_status', payment_status);
               }
          }
          if (payment_method) {
               if (Array.isArray(payment_method)) {
                    query = query.whereIn('inv_supplier_payments.payment_method', payment_method);
               } else {
                    query = query.where('inv_supplier_payments.payment_method', payment_method);
               }
          }
          if (search) {
               query = query.where((qb) => {
                    qb.where('inv_supplier_payments.payment_id', 'like', `%${search}%`)
                         .orWhere('inv_supplier_payments.reference_number', 'like', `%${search}%`)
                         .orWhere('inv_supplier_payments.payment_notes', 'like', `%${search}%`)
                         .orWhere('inv_suppliers.name', 'like', `%${search}%`)
                         .orWhere('inv_purchase_orders.order_number', 'like', `%${search}%`);
               });
          }
          if (startDate) {
               query = query.where('inv_supplier_payments.payment_date', '>=', startDate);
          }
          if (endDate) {
               query = query.where('inv_supplier_payments.payment_date', '<=', endDate);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().select(connection.raw('COUNT(DISTINCT ??) as ??', ['inv_supplier_payments.id', 'count'])).first();
          const totalResult = await totalQuery as any;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const payments = rawData.map((result: any) => ({
               id: result.id,
               payment_id: result.payment_id,
               supplier_id: result.supplier_id,
               purchase_order_id: result.purchase_order_id,
               payment_amount: parseFloat(result.payment_amount),
               payment_date: result.payment_date,
               payment_method: result.payment_method,
               payment_account_id: result.payment_account_id,
               payment_account_name: result.payment_account_name,
               payment_account_gl_code: result.payment_account_gl_code,
               branchid: result.branchid,
               payment_status: result.payment_status,
               reference_number: result.reference_number,
               payment_notes: result.payment_notes,
               total_allocated: parseFloat(result.total_allocated),
               created_by: result.created_by,
               approved_by: result.approved_by,
               approved_at: result.approved_at,
               processed_at: result.processed_at,
               created_at: result.created_at,
               updated_at: result.updated_at,
               supplier_name: result.supplier_name,
               po_order_number: result.po_order_number,
               expense_synced: Boolean(result.expense_synced)
          }));

          return {
               payments,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby
          };
     }

     async update(id: string, updates: UpdateSupplierPaymentRequest, actor: AuthUser): Promise<SupplierPayment | null> {
          const connection = await this.connection;

          if (['completed', 'refunded'].includes(updates.payment_status)) throw new SupplierPaymentValidationError('Use the approval workflow to complete a payment; completed payments require a separate reversal');
          const currentPayment = await this.findById(id);
          if (!currentPayment) {
               throw new Error('Supplier payment not found');
          }

          if (currentPayment.payment_status === 'completed' || currentPayment.payment_status === 'refunded') {
               throw new Error('Cannot update a completed or refunded payment');
          }

          const updateData: any = {
               updated_at: new Date()
          };

          // Map updates
          if (updates.payment_amount !== undefined) {
               if (updates.payment_amount <= 0) {
                    throw new Error('Payment amount must be positive');
               }
               updateData.payment_amount = updates.payment_amount;
          }
          if (updates.payment_date !== undefined) updateData.payment_date = updates.payment_date;
          if (updates.payment_method !== undefined) updateData.payment_method = updates.payment_method;
          if (updates.payment_status !== undefined) updateData.payment_status = updates.payment_status;
          if (updates.reference_number !== undefined) updateData.reference_number = updates.reference_number;
          if (updates.payment_notes !== undefined) updateData.payment_notes = updates.payment_notes;
          if (updates.approved_by !== undefined) updateData.approved_by = updates.approved_by;
          if (updates.processed_at !== undefined) updateData.processed_at = updates.processed_at;

          // Set approval timestamp if approving
          if (updates.approved_by && !currentPayment.approved_at) {
               updateData.approved_at = new Date();
          }

          if (updates.payment_account_id !== undefined || currentPayment.payment_account_id) {
               const funding = await validateSupplierPaymentFunding(connection, actor, updates.payment_account_id ?? currentPayment.payment_account_id, updates.payment_method ?? currentPayment.payment_method, currentPayment.branchid);
               updateData.payment_account_id = funding.account.id;
               updateData.branchid = funding.branchid;
          }
          delete updateData.approved_by;
          delete updateData.approved_at;
          delete updateData.processed_at;
          await connection('inv_supplier_payments').where({ id }).whereNotIn('payment_status', ['completed', 'refunded']).update(updateData);

          return await this.findById(id);
     }

     async approve(id: string, actor: AuthUser, input: { payment_account_id?: number; payment_method?: string } = {}): Promise<SupplierPayment | null> {
          const connection = await this.connection;
          await connection.transaction(async trx => {
               const payment = await trx('inv_supplier_payments').where({ id }).forUpdate().first();
               if (!payment) throw new SupplierPaymentValidationError('Supplier payment not found', 404);
               if (!actor?.employeeid) throw new SupplierPaymentValidationError('Authentication required', 401);
               if (payment.payment_status === 'completed') {
                    if (actor.branch != null && payment.branchid != null && Number(actor.branch) !== Number(payment.branchid)) throw new SupplierPaymentValidationError('Payment belongs to another branch', 403);
                    const decision = await new AuthorityService(this.tenantId).can(actor.employeeid, 'purchase_order.pay', Number(payment.payment_amount), payment.branchid ?? actor.branch);
                    if (!decision.allowed) throw new SupplierPaymentValidationError(decision.reason, 403);
                    if (input.payment_account_id && Number(input.payment_account_id) !== Number(payment.payment_account_id)) throw new SupplierPaymentValidationError('A completed payment source cannot be changed');
                    if (payment.payment_account_id) await validateSupplierPaymentFunding(trx, actor, payment.payment_account_id, payment.payment_method, payment.branchid);
                    return;
               }
               if (payment.payment_status !== 'pending') throw new SupplierPaymentValidationError('Only pending payments can be approved');
               const accountId = input.payment_account_id ?? payment.payment_account_id;
               const method = input.payment_method ?? payment.payment_method;
               const funding = await validateSupplierPaymentFunding(trx, actor, accountId, method, payment.branchid);
               const decision = await new AuthorityService(this.tenantId).can(actor.employeeid, 'purchase_order.pay', Number(payment.payment_amount), funding.branchid);
               if (!decision.allowed) throw new SupplierPaymentValidationError(decision.reason, 403);
               await trx('inv_supplier_payments').where({ id }).update({
                    payment_account_id: funding.account.id, payment_account_gl_code: funding.account.gl_account_code,
                    branchid: funding.branchid, payment_method: method, payment_status: 'completed',
                    approved_by: String(actor.employeeid), approved_at: new Date(), processed_at: new Date(), updated_at: new Date()
               });
               await enqueueSupplierPayment(this.tenantId, id, trx);
          });
          return this.findById(id);
     }

     async cancel(id: string): Promise<SupplierPayment | null> {
          const connection = await this.connection;

          const currentPayment = await this.findById(id);
          if (!currentPayment) {
               throw new Error('Supplier payment not found');
          }

          if (currentPayment.payment_status === 'completed' || currentPayment.payment_status === 'refunded') {
               throw new Error('Cannot cancel a completed or refunded payment');
          }

          await connection('inv_supplier_payments')
               .where({ id })
               .update({
                    payment_status: 'cancelled',
                    updated_at: new Date()
               });

          return await this.findById(id);
     }

     async reject(id: string, rejectedBy: number, rejectionReason?: string): Promise<SupplierPayment | null> {
          const connection = await this.connection;

          const currentPayment = await this.findById(id);
          if (!currentPayment) {
               throw new Error('Supplier payment not found');
          }

          if (currentPayment.payment_status !== 'pending') {
               throw new Error('Only pending payments can be rejected');
          }

          const updateData: any = {
               payment_status: 'reject',
               approved_by: rejectedBy,
               processed_at: new Date(),
               updated_at: new Date()
          };

          // Add rejection reason to payment notes if provided
          if (rejectionReason) {
               const currentNotes = currentPayment.payment_notes || '';
               const rejectionNote = `[REJECTED by user ${rejectedBy} on ${new Date()}]: ${rejectionReason}`;
               updateData.payment_notes = currentNotes ? `${currentNotes}\n\n${rejectionNote}` : rejectionNote;
          }

          await connection('inv_supplier_payments')
               .where({ id })
               .update(updateData);

          return await this.findById(id);
     }

     async getPaymentAllocations(paymentId: string): Promise<SupplierPaymentAllocation[]> {
          const connection = await this.connection;

          const results = await connection('inv_supplier_payment_allocations')
               .leftJoin('inv_purchase_orders', 'inv_supplier_payment_allocations.purchase_order_id', 'inv_purchase_orders.id')
               .leftJoin('inv_purchase_order_items', 'inv_supplier_payment_allocations.order_item_id', 'inv_purchase_order_items.id')
               .select(
                    'inv_supplier_payment_allocations.*',
                    'inv_purchase_orders.order_number as po_order_number',
                    'inv_purchase_order_items.quantity_ordered',
                    'inv_purchase_order_items.unit_price',
                    'inv_purchase_order_items.line_total'
               )
               .where('inv_supplier_payment_allocations.payment_id', paymentId)
               .orderBy('inv_supplier_payment_allocations.created_at', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               payment_id: result.payment_id,
               purchase_order_id: result.purchase_order_id,
               order_item_id: result.order_item_id,
               allocated_amount: parseFloat(result.allocated_amount),
               allocation_notes: result.allocation_notes,
               created_at: result.created_at,
               purchase_order: result.purchase_order_id ? {
                    id: result.purchase_order_id,
                    order_number: result.po_order_number
               } : undefined,
               order_item: result.order_item_id ? {
                    id: result.order_item_id,
                    quantity_ordered: result.quantity_ordered,
                    unit_price: parseFloat(result.unit_price),
                    line_total: parseFloat(result.line_total)
               } : undefined
          }));
     }

     async addAllocation(paymentId: string, allocation: CreateSupplierPaymentAllocationRequest): Promise<SupplierPaymentAllocation> {
          const connection = await this.connection;

          // Validate payment exists and is not completed/refunded
          const payment = await connection('inv_supplier_payments')
               .where('id', paymentId)
               .whereNotIn('payment_status', ['completed', 'refunded'])
               .first();

          if (!payment) {
               throw new Error('Payment not found or cannot be modified');
          }

          // Validate allocation amount
          if (allocation.allocated_amount <= 0) {
               throw new Error('Allocation amount must be positive');
          }

          // Validate purchase order item if specified
          if (allocation.order_item_id) {
               const orderItem = await connection('inv_purchase_order_items')
                    .where('id', allocation.order_item_id)
                    .where('order_id', payment.purchase_order_id)
                    .first();

               if (!orderItem) {
                    throw new Error(`Order item ${allocation.order_item_id} not found in purchase order`);
               }
          }

          const allocationData = {
               id: this.generateAllocationId(),
               payment_id: paymentId,
               purchase_order_id: payment.purchase_order_id,
               order_item_id: allocation.order_item_id || null,
               allocated_amount: allocation.allocated_amount,
               allocation_notes: allocation.allocation_notes || null,
               created_at: new Date()
          };

          await connection('inv_supplier_payment_allocations').insert(allocationData);

          // Update total allocated amount
          await this.updateTotalAllocated(paymentId);

          // Fetch the created allocation with relations
          const createdAllocation = await connection('inv_supplier_payment_allocations')
               .leftJoin('inv_purchase_orders', 'inv_supplier_payment_allocations.purchase_order_id', 'inv_purchase_orders.id')
               .leftJoin('inv_purchase_order_items', 'inv_supplier_payment_allocations.order_item_id', 'inv_purchase_order_items.id')
               .select(
                    'inv_supplier_payment_allocations.*',
                    'inv_purchase_orders.order_number as po_order_number',
                    'inv_purchase_order_items.quantity_ordered',
                    'inv_purchase_order_items.unit_price',
                    'inv_purchase_order_items.line_total'
               )
               .where('inv_supplier_payment_allocations.id', allocationData.id)
               .first();

          return {
               id: createdAllocation.id,
               payment_id: createdAllocation.payment_id,
               purchase_order_id: createdAllocation.purchase_order_id,
               order_item_id: createdAllocation.order_item_id,
               allocated_amount: parseFloat(createdAllocation.allocated_amount),
               allocation_notes: createdAllocation.allocation_notes,
               created_at: createdAllocation.created_at,
               purchase_order: createdAllocation.purchase_order_id ? {
                    id: createdAllocation.purchase_order_id,
                    order_number: createdAllocation.po_order_number
               } : undefined,
               order_item: createdAllocation.order_item_id ? {
                    id: createdAllocation.order_item_id,
                    quantity_ordered: createdAllocation.quantity_ordered,
                    unit_price: parseFloat(createdAllocation.unit_price),
                    line_total: parseFloat(createdAllocation.line_total)
               } : undefined
          };
     }

     async removeAllocation(allocationId: string): Promise<boolean> {
          const connection = await this.connection;

          // Check if allocation exists and payment is not completed/refunded
          const allocation = await connection('inv_supplier_payment_allocations')
               .leftJoin('inv_supplier_payments', 'inv_supplier_payment_allocations.payment_id', 'inv_supplier_payments.id')
               .select('inv_supplier_payment_allocations.*', 'inv_supplier_payments.payment_status')
               .where('inv_supplier_payment_allocations.id', allocationId)
               .whereNotIn('inv_supplier_payments.payment_status', ['completed', 'refunded'])
               .first();

          if (!allocation) {
               throw new Error('Allocation not found or payment cannot be modified');
          }

          await connection('inv_supplier_payment_allocations')
               .where('id', allocationId)
               .del();

          // Update total allocated amount
          await this.updateTotalAllocated(allocation.payment_id);

          return true;
     }

     async getPaymentSummary(filters: SupplierPaymentFilters): Promise<SupplierPaymentSummary> {
          const connection = await this.connection;
          const {
               supplier_id,
               startDate,
               endDate
          } = filters;

          let query = connection('inv_supplier_payments')
               .select(
                    connection.raw('COUNT(*) as total_payments'),
                    connection.raw('SUM(payment_amount) as total_amount'),
                    connection.raw('COUNT(CASE WHEN payment_status = "completed" THEN 1 END) as completed_payments'),
                    connection.raw('COUNT(CASE WHEN payment_status = "pending" THEN 1 END) as pending_payments'),
                    connection.raw('COUNT(CASE WHEN payment_status = "failed" THEN 1 END) as failed_payments'),
                    connection.raw('COUNT(CASE WHEN payment_status = "cancelled" THEN 1 END) as cancelled_payments'),
                    connection.raw('COUNT(CASE WHEN payment_status = "refunded" THEN 1 END) as refunded_payments'),
                    connection.raw('MIN(payment_date) as period_start'),
                    connection.raw('MAX(payment_date) as period_end')
               );

          // Apply filters
          if (supplier_id) {
               query = query.where('supplier_id', supplier_id);
          }
          if (startDate) {
               query = query.where('payment_date', '>=', startDate);
          }
          if (endDate) {
               query = query.where('payment_date', '<=', endDate);
          }

          const result = await query.first() as any;

          // Get payment methods breakdown
          let methodsQuery = connection('inv_supplier_payments')
               .select('payment_method')
               .select(connection.raw('COUNT(*) as count'))
               .groupBy('payment_method');

          if (supplier_id) {
               methodsQuery = methodsQuery.where('supplier_id', supplier_id);
          }
          if (startDate) {
               methodsQuery = methodsQuery.where('payment_date', '>=', startDate);
          }
          if (endDate) {
               methodsQuery = methodsQuery.where('payment_date', '<=', endDate);
          }

          const methodsResult = await methodsQuery;
          const payment_methods_breakdown: Record<string, number> = {};
          methodsResult.forEach((row: any) => {
               payment_methods_breakdown[row.payment_method] = parseInt(row.count);
          });

          return {
               total_payments: parseInt(result.total_payments) || 0,
               total_amount: parseFloat(result.total_amount) || 0,
               pending_payments: parseInt(result.pending_payments) || 0,
               completed_payments: parseInt(result.completed_payments) || 0,
               failed_payments: parseInt(result.failed_payments) || 0,
               payment_methods_breakdown,
               period_start: result.period_start || new Date(),
               period_end: result.period_end || new Date()
          };
     }

     private async updateTotalAllocated(paymentId: string, trx?: any): Promise<void> {
          const connection = trx || await this.connection;

          const result = await connection('inv_supplier_payment_allocations')
               .where('payment_id', paymentId)
               .sum('allocated_amount as total')
               .first();

          const totalAllocated = parseFloat(result?.total || 0);

          await connection('inv_supplier_payments')
               .where('id', paymentId)
               .update({ total_allocated: totalAllocated });
     }

}
