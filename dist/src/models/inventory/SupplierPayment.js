"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierPaymentModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class SupplierPaymentModel {
    constructor(tenantId) {
        this.paymentCounter = 0;
        this.allocationCounter = 0;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    generatePaymentId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-4);
        return `PAY-${year}${month}${day}-${timestamp}`;
    }
    generateAllocationId() {
        const timestamp = Date.now();
        this.allocationCounter += 1;
        return `ALLOC-${timestamp}${this.allocationCounter.toString().padStart(3, '0')}`;
    }
    async create(request) {
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
        if (request.payment_amount <= 0) {
            throw new Error('Payment amount must be positive');
        }
        const paymentId = this.generatePaymentId();
        const paymentDate = request.payment_date || new Date().toISOString().split('T')[0];
        const paymentData = {
            id: `SP-${Date.now()}`,
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
            created_by: request.created_by,
            approved_by: null,
            approved_at: null,
            processed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        // Start transaction
        const trx = await connection.transaction();
        try {
            // Insert payment
            await trx('inv_supplier_payments').insert(paymentData);
            // Insert allocations if provided
            if (request.allocations && request.allocations.length > 0) {
                const allocations = request.allocations.map(allocation => {
                    var _a;
                    // Validate allocation amount
                    if (allocation.allocated_amount <= 0) {
                        throw new Error('Allocation amount must be positive');
                    }
                    // Validate purchase order item if specified
                    if (allocation.order_item_id) {
                        const orderItem = (_a = purchaseOrder.items) === null || _a === void 0 ? void 0 : _a.find(item => item.id === allocation.order_item_id);
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
                        created_at: new Date().toISOString()
                    };
                });
                await trx('inv_supplier_payment_allocations').insert(allocations);
                // Update total allocated amount
                await this.updateTotalAllocated(paymentData.id, trx);
            }
            await trx.commit();
            return await this.findById(paymentData.id);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_supplier_payments')
            .leftJoin('inv_suppliers', 'inv_supplier_payments.supplier_id', 'inv_suppliers.id')
            .leftJoin('inv_purchase_orders', 'inv_supplier_payments.purchase_order_id', 'inv_purchase_orders.id')
            .select('inv_supplier_payments.*', 'inv_suppliers.id as supplier_id_join', 'inv_suppliers.name as supplier_name', 'inv_suppliers.contact as supplier_contact', 'inv_suppliers.email as supplier_email', 'inv_purchase_orders.id as po_id_join', 'inv_purchase_orders.order_number as po_order_number', 'inv_purchase_orders.total_amount as po_total_amount', 'inv_purchase_orders.status as po_status')
            .where('inv_supplier_payments.id', id)
            .first();
        if (!result)
            return null;
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
            allocations: allocations
        };
    }
    async findByPaymentId(paymentId) {
        const connection = await this.connection;
        const result = await connection('inv_supplier_payments')
            .where('payment_id', paymentId)
            .first();
        if (!result)
            return null;
        return await this.findById(result.id);
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', supplier_id, purchase_order_id, payment_status, payment_method, startDate, endDate, search } = filters;
        let query = connection('inv_supplier_payments')
            .leftJoin('inv_suppliers', 'inv_supplier_payments.supplier_id', 'inv_suppliers.id')
            .leftJoin('inv_purchase_orders', 'inv_supplier_payments.purchase_order_id', 'inv_purchase_orders.id')
            .select('inv_supplier_payments.*', 'inv_suppliers.name as supplier_name', 'inv_purchase_orders.order_number as po_order_number')
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
            }
            else {
                query = query.where('inv_supplier_payments.payment_status', payment_status);
            }
        }
        if (payment_method) {
            if (Array.isArray(payment_method)) {
                query = query.whereIn('inv_supplier_payments.payment_method', payment_method);
            }
            else {
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
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const payments = rawData.map((result) => ({
            id: result.id,
            payment_id: result.payment_id,
            supplier_id: result.supplier_id,
            purchase_order_id: result.purchase_order_id,
            payment_amount: parseFloat(result.payment_amount),
            payment_date: result.payment_date,
            payment_method: result.payment_method,
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
            po_order_number: result.po_order_number
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
    async update(id, updates) {
        const connection = await this.connection;
        const currentPayment = await this.findById(id);
        if (!currentPayment) {
            throw new Error('Supplier payment not found');
        }
        if (currentPayment.payment_status === 'completed' || currentPayment.payment_status === 'refunded') {
            throw new Error('Cannot update a completed or refunded payment');
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        // Map updates
        if (updates.payment_amount !== undefined) {
            if (updates.payment_amount <= 0) {
                throw new Error('Payment amount must be positive');
            }
            updateData.payment_amount = updates.payment_amount;
        }
        if (updates.payment_date !== undefined)
            updateData.payment_date = updates.payment_date;
        if (updates.payment_method !== undefined)
            updateData.payment_method = updates.payment_method;
        if (updates.payment_status !== undefined)
            updateData.payment_status = updates.payment_status;
        if (updates.reference_number !== undefined)
            updateData.reference_number = updates.reference_number;
        if (updates.payment_notes !== undefined)
            updateData.payment_notes = updates.payment_notes;
        if (updates.approved_by !== undefined)
            updateData.approved_by = updates.approved_by;
        if (updates.processed_at !== undefined)
            updateData.processed_at = updates.processed_at;
        // Set approval timestamp if approving
        if (updates.approved_by && !currentPayment.approved_at) {
            updateData.approved_at = new Date().toISOString();
        }
        await connection('inv_supplier_payments')
            .where({ id })
            .update(updateData);
        return await this.findById(id);
    }
    async approve(id, approvedBy) {
        const connection = await this.connection;
        const currentPayment = await this.findById(id);
        if (!currentPayment) {
            throw new Error('Supplier payment not found');
        }
        if (currentPayment.payment_status !== 'pending') {
            throw new Error('Only pending payments can be approved');
        }
        await connection('inv_supplier_payments')
            .where({ id })
            .update({
            payment_status: 'completed',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        // Get the updated payment
        const updatedPayment = await this.findById(id);
        // Create journal entries for the approved payment
        if (updatedPayment) {
            await this.createJournalEntries(updatedPayment);
        }
        return updatedPayment;
    }
    async cancel(id) {
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
            updated_at: new Date().toISOString()
        });
        return await this.findById(id);
    }
    async reject(id, rejectedBy, rejectionReason) {
        const connection = await this.connection;
        const currentPayment = await this.findById(id);
        if (!currentPayment) {
            throw new Error('Supplier payment not found');
        }
        if (currentPayment.payment_status !== 'pending') {
            throw new Error('Only pending payments can be rejected');
        }
        const updateData = {
            payment_status: 'reject',
            approved_by: rejectedBy, // Use approved_by field to track who rejected
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        // Add rejection reason to payment notes if provided
        if (rejectionReason) {
            const currentNotes = currentPayment.payment_notes || '';
            const rejectionNote = `[REJECTED by user ${rejectedBy} on ${new Date().toISOString().split('T')[0]}]: ${rejectionReason}`;
            updateData.payment_notes = currentNotes ? `${currentNotes}\n\n${rejectionNote}` : rejectionNote;
        }
        await connection('inv_supplier_payments')
            .where({ id })
            .update(updateData);
        return await this.findById(id);
    }
    async getPaymentAllocations(paymentId) {
        const connection = await this.connection;
        const results = await connection('inv_supplier_payment_allocations')
            .leftJoin('inv_purchase_orders', 'inv_supplier_payment_allocations.purchase_order_id', 'inv_purchase_orders.id')
            .leftJoin('inv_purchase_order_items', 'inv_supplier_payment_allocations.order_item_id', 'inv_purchase_order_items.id')
            .select('inv_supplier_payment_allocations.*', 'inv_purchase_orders.order_number as po_order_number', 'inv_purchase_order_items.quantity_ordered', 'inv_purchase_order_items.unit_price', 'inv_purchase_order_items.line_total')
            .where('inv_supplier_payment_allocations.payment_id', paymentId)
            .orderBy('inv_supplier_payment_allocations.created_at', 'ASC');
        return results.map((result) => ({
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
    async addAllocation(paymentId, allocation) {
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
            created_at: new Date().toISOString()
        };
        await connection('inv_supplier_payment_allocations').insert(allocationData);
        // Update total allocated amount
        await this.updateTotalAllocated(paymentId);
        // Fetch the created allocation with relations
        const createdAllocation = await connection('inv_supplier_payment_allocations')
            .leftJoin('inv_purchase_orders', 'inv_supplier_payment_allocations.purchase_order_id', 'inv_purchase_orders.id')
            .leftJoin('inv_purchase_order_items', 'inv_supplier_payment_allocations.order_item_id', 'inv_purchase_order_items.id')
            .select('inv_supplier_payment_allocations.*', 'inv_purchase_orders.order_number as po_order_number', 'inv_purchase_order_items.quantity_ordered', 'inv_purchase_order_items.unit_price', 'inv_purchase_order_items.line_total')
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
    async removeAllocation(allocationId) {
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
    async getPaymentSummary(filters) {
        const connection = await this.connection;
        const { supplier_id, startDate, endDate } = filters;
        let query = connection('inv_supplier_payments')
            .select(connection.raw('COUNT(*) as total_payments'), connection.raw('SUM(payment_amount) as total_amount'), connection.raw('COUNT(CASE WHEN payment_status = "completed" THEN 1 END) as completed_payments'), connection.raw('COUNT(CASE WHEN payment_status = "pending" THEN 1 END) as pending_payments'), connection.raw('COUNT(CASE WHEN payment_status = "failed" THEN 1 END) as failed_payments'), connection.raw('COUNT(CASE WHEN payment_status = "cancelled" THEN 1 END) as cancelled_payments'), connection.raw('COUNT(CASE WHEN payment_status = "refunded" THEN 1 END) as refunded_payments'), connection.raw('MIN(payment_date) as period_start'), connection.raw('MAX(payment_date) as period_end'));
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
        const result = await query.first();
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
        const payment_methods_breakdown = {};
        methodsResult.forEach((row) => {
            payment_methods_breakdown[row.payment_method] = parseInt(row.count);
        });
        return {
            total_payments: parseInt(result.total_payments) || 0,
            total_amount: parseFloat(result.total_amount) || 0,
            pending_payments: parseInt(result.pending_payments) || 0,
            completed_payments: parseInt(result.completed_payments) || 0,
            failed_payments: parseInt(result.failed_payments) || 0,
            payment_methods_breakdown,
            period_start: result.period_start || new Date().toISOString().split('T')[0],
            period_end: result.period_end || new Date().toISOString().split('T')[0]
        };
    }
    async updateTotalAllocated(paymentId, trx) {
        const connection = trx || await this.connection;
        const result = await connection('inv_supplier_payment_allocations')
            .where('payment_id', paymentId)
            .sum('allocated_amount as total')
            .first();
        const totalAllocated = parseFloat((result === null || result === void 0 ? void 0 : result.total) || 0);
        await connection('inv_supplier_payments')
            .where('id', paymentId)
            .update({ total_allocated: totalAllocated });
    }
    async createJournalEntries(payment) {
        var _a;
        const connection = await this.connection;
        // Generate journal entry ID
        const entryId = `JE-${Date.now()}`;
        const entryDate = payment.payment_date;
        // Start transaction for journal entries
        const trx = await connection.transaction();
        try {
            // Create journal entry header
            await trx('acc_journal_entry_lines').insert({
                id: `${entryId}-1`,
                account_id: 'acc-2000', // Accounts Payable
                debit_amount: payment.payment_amount,
                credit_amount: 0,
                line_description: `Supplier payment: ${payment.payment_id} - ${((_a = payment.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Supplier'}`,
                reference_id: payment.id,
                reference_type: 'supplier_payment',
                entry_date: entryDate,
                source_module: 'inventory',
                entry_status: 'posted',
                posted_by: payment.approved_by,
                posted_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            // Create journal entry line for cash/bank reduction
            await trx('acc_journal_entry_lines').insert({
                id: `${entryId}-2`,
                account_id: 'acc-1000', // Cash
                debit_amount: 0,
                credit_amount: payment.payment_amount,
                line_description: `Cash payment: ${payment.payment_id} - ${payment.payment_method}`,
                reference_id: payment.id,
                reference_type: 'supplier_payment',
                entry_date: entryDate,
                source_module: 'inventory',
                entry_status: 'posted',
                posted_by: payment.approved_by,
                posted_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            await trx.commit();
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
}
exports.SupplierPaymentModel = SupplierPaymentModel;
