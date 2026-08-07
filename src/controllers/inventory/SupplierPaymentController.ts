import { Request, Response } from 'express';
import { SupplierPaymentModel } from '../../models/inventory';
import KnexConnection from '../../database/KnexConnections';
import { SupplierPaymentExpenseSync } from '../../models/inventory/SupplierPaymentExpenseSync';
import {
     CreateSupplierPaymentRequest,
     UpdateSupplierPaymentRequest,
     SupplierPaymentListResponse,
     SupplierPaymentGroupedResponse,
     SupplierPaymentPurchaseOrderGroup,
     CreateSupplierPaymentAllocationRequest,
     SupplierPaymentFilters,
     SupplierPaymentSummary
} from '../../models/inventory/supplierPaymentTypes';
import { ApiResponse, ValidationError } from '../../models/inventory/types';
import { NotificationDispatcher } from '../../models/application/notifications/services/NotificationDispatcher';

export class SupplierPaymentController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private validateCreateSupplierPaymentRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (!data.supplier_id || typeof data.supplier_id !== 'string') {
               errors.push({
                    field: 'supplier_id',
                    message: 'Supplier ID is required',
                    value: data.supplier_id
               });
          }

          if (!data.purchase_order_id || typeof data.purchase_order_id !== 'string') {
               errors.push({
                    field: 'purchase_order_id',
                    message: 'Purchase order ID is required',
                    value: data.purchase_order_id
               });
          }

          if (!data.payment_amount || typeof data.payment_amount !== 'number' || data.payment_amount <= 0) {
               errors.push({
                    field: 'payment_amount',
                    message: 'Payment amount must be a positive number',
                    value: data.payment_amount
               });
          }

          if (data.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.payment_date)) {
               errors.push({
                    field: 'payment_date',
                    message: 'Payment date must be in YYYY-MM-DD format',
                    value: data.payment_date
               });
          }

          const validPaymentMethods = ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other'];
          if (data.payment_method && !validPaymentMethods.includes(data.payment_method)) {
               errors.push({
                    field: 'payment_method',
                    message: 'Invalid payment method',
                    value: data.payment_method
               });
          }

          if (data.allocations && Array.isArray(data.allocations)) {
               data.allocations.forEach((allocation: any, index: number) => {
                    if (!allocation.allocated_amount || typeof allocation.allocated_amount !== 'number' || allocation.allocated_amount <= 0) {
                         errors.push({
                              field: `allocations[${index}].allocated_amount`,
                              message: 'Allocated amount must be a positive number',
                              value: allocation.allocated_amount
                         });
                    }
               });
          }

          return { isValid: errors.length === 0, errors };
     }

     private validateUpdateSupplierPaymentRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (data.payment_amount !== undefined && (typeof data.payment_amount !== 'number' || data.payment_amount <= 0)) {
               errors.push({
                    field: 'payment_amount',
                    message: 'Payment amount must be a positive number',
                    value: data.payment_amount
               });
          }

          if (data.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.payment_date)) {
               errors.push({
                    field: 'payment_date',
                    message: 'Payment date must be in YYYY-MM-DD format',
                    value: data.payment_date
               });
          }

          const validPaymentMethods = ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other'];
          if (data.payment_method && !validPaymentMethods.includes(data.payment_method)) {
               errors.push({
                    field: 'payment_method',
                    message: 'Invalid payment method',
                    value: data.payment_method
               });
          }

          const validStatuses = ['pending', 'completed', 'failed', 'cancelled', 'refunded'];
          if (data.payment_status && !validStatuses.includes(data.payment_status)) {
               errors.push({
                    field: 'payment_status',
                    message: 'Invalid payment status',
                    value: data.payment_status
               });
          }

          return { isValid: errors.length === 0, errors };
     }

     private validateAllocationRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (!data.allocated_amount || typeof data.allocated_amount !== 'number' || data.allocated_amount <= 0) {
               errors.push({
                    field: 'allocated_amount',
                    message: 'Allocated amount must be a positive number',
                    value: data.allocated_amount
               });
          }

          return { isValid: errors.length === 0, errors };
     }

     async create(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);

               // Extract employeeid from query parameters
               const employeeId = req.body.created_by as string;
               if (!employeeId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Employee ID is required',
                         data: null
                    };
                    res.status(400).json(response);
                    return;
               }

               const validation = this.validateCreateSupplierPaymentRequest(req.body);
               if (!validation.isValid) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Validation failed',
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Validation failed',
                              details: validation.errors
                         },
                         data: null
                    };
                    res.status(400).json(response);
                    return;
               }

               // Add created_by to the request
               const paymentRequest = {
                    ...req.body,
                    created_by: employeeId
               };

               const payment = await model.create(paymentRequest as CreateSupplierPaymentRequest);

               if (payment && payment.id) {
                    const status = String(payment.payment_status || '').toLowerCase();
                    let eventCode = 'SUPPLIER_PAYMENT_PENDING';
                    if (status === 'completed') eventCode = 'SUPPLIER_PAYMENT_PROCESSED';
                    else if (status === 'failed') eventCode = 'SUPPLIER_PAYMENT_FAILED';
                    NotificationDispatcher.dispatch(tenantId, eventCode, { supplierId: paymentRequest.supplier_id }, Number(employeeId)).catch(() => { });
                    if (status === 'completed') {
                         NotificationDispatcher.dispatch(tenantId, 'PAYMENT_RECEIVED', { supplierId: paymentRequest.supplier_id }, Number(employeeId)).catch(() => { });
                    } else if (status === 'pending') {
                         NotificationDispatcher.dispatch(tenantId, 'PAYMENT_PENDING', { supplierId: paymentRequest.supplier_id }, Number(employeeId)).catch(() => { });
                    } else if (status === 'failed') {
                         NotificationDispatcher.dispatch(tenantId, 'PAYMENT_FAILED', { supplierId: paymentRequest.supplier_id }, Number(employeeId)).catch(() => { });
                    }
               }

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment created successfully',
                    data: payment
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error creating supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to create supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async getById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const id = req.params.id as string;

               const payment = await model.findById(id);

               if (!payment) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Supplier payment not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment retrieved successfully',
                    data: payment
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async getByPaymentId(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const paymentId = req.params.paymentId as string;

               const payment = await model.findByPaymentId(paymentId);

               if (!payment) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Supplier payment not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment retrieved successfully',
                    data: payment
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async list(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);

               const filters: SupplierPaymentFilters = {
                    page: parseInt(req.query.page as string) || 1,
                    count: parseInt(req.query.count as string) || 10,
                    supplier_id: req.query.supplier_id as string,
                    purchase_order_id: req.query.purchase_order_id as string,
                    payment_status: req.query.payment_status as 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded',
                    payment_method: req.query.payment_method as 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'wire_transfer' | 'other',
                    startDate: req.query.startDate as string,
                    endDate: req.query.endDate as string,
                    search: req.query.search as string,
                    sortby: (req.query.sortby as 'ASC' | 'DESC') || 'DESC'
               };

               const result = await model.findMany(filters);

               const response: ApiResponse<SupplierPaymentListResponse> = {
                    success: true,
                    ...result
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving supplier payments:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve supplier payments',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async listGrouped(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);

               const filters: SupplierPaymentFilters = {
                    page: parseInt(req.query.page as string) || 1,
                    count: parseInt(req.query.count as string) || 10,
                    supplier_id: req.query.supplier_id as string,
                    purchase_order_id: req.query.purchase_order_id as string,
                    payment_status: req.query.payment_status as 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded',
                    payment_method: req.query.payment_method as 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'wire_transfer' | 'other',
                    startDate: req.query.startDate as string,
                    endDate: req.query.endDate as string,
                    search: req.query.search as string,
                    sortby: (req.query.sortby as 'ASC' | 'DESC') || 'DESC'
               };

               const result = await model.findMany(filters);

               // Group payments by purchase order
               const groupedPayments = new Map<string, SupplierPaymentPurchaseOrderGroup>();

               for (const payment of result.payments) {
                    const poId = payment.purchase_order_id;

                    if (!groupedPayments.has(poId)) {
                         groupedPayments.set(poId, {
                              purchase_order_id: poId,
                              purchase_order: payment.purchase_order ? {
                                   id: payment.purchase_order.id,
                                   order_number: payment.purchase_order.order_number,
                                   total_amount: payment.purchase_order.total_amount,
                                   status: payment.purchase_order.status,
                                   supplier_name: payment.supplier?.name
                              } : undefined,
                              payments: [],
                              total_payment_amount: 0,
                              pending_amount: 0,
                              completed_amount: 0,
                              payment_count: 0
                         });
                    }

                    const group = groupedPayments.get(poId)!;
                    group.payments.push(payment);
                    group.total_payment_amount += payment.payment_amount;
                    group.payment_count += 1;

                    if (payment.payment_status === 'pending') {
                         group.pending_amount += payment.payment_amount;
                    } else if (payment.payment_status === 'completed') {
                         group.completed_amount += payment.payment_amount;
                    }
               }

               const purchaseOrders = Array.from(groupedPayments.values());

               // Sort purchase orders by the specified sort order
               purchaseOrders.sort((a, b) => {
                    // For now, sort by purchase order ID or order number
                    const aKey = a.purchase_order?.order_number || a.purchase_order_id;
                    const bKey = b.purchase_order?.order_number || b.purchase_order_id;

                    if (filters.sortby === 'ASC') {
                         return aKey.localeCompare(bKey);
                    } else {
                         return bKey.localeCompare(aKey);
                    }
               });

               const groupedResponse: SupplierPaymentGroupedResponse = {
                    purchase_orders: purchaseOrders,
                    total: result.total,
                    page: result.page,
                    count: result.count,
                    totalPages: result.totalPages,
                    sortby: result.sortby
               };

               const response: ApiResponse<SupplierPaymentGroupedResponse> = {
                    success: true,
                    message: 'Supplier payments grouped by purchase order retrieved successfully',
                    data: groupedResponse
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving grouped supplier payments:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve grouped supplier payments',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async update(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const { id } = req.params;

               const validation = this.validateUpdateSupplierPaymentRequest(req.body);
               if (!validation.isValid) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Validation failed',
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Validation failed',
                              details: validation.errors
                         },
                         data: null
                    };
                    res.status(400).json(response);
                    return;
               }

               const payment = await model.update(id as string, req.body as UpdateSupplierPaymentRequest);

               if (!payment) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Supplier payment not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               const status = String((payment as any).payment_status || req.body?.payment_status || '').toLowerCase();
               const supplierId = (payment as any).supplier_id || id;
               const actor = Number((req.body as any)?.updated_by || (req.query as any)?.employeeid || 0) || undefined;
               if (status === 'completed') {
                    NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_PAYMENT_PROCESSED', { supplierId }, actor).catch(() => { });
                    NotificationDispatcher.dispatch(tenantId, 'PAYMENT_RECEIVED', { supplierId }, actor).catch(() => { });
               } else if (status === 'failed') {
                    NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_PAYMENT_FAILED', { supplierId }, actor).catch(() => { });
                    NotificationDispatcher.dispatch(tenantId, 'PAYMENT_FAILED', { supplierId }, actor).catch(() => { });
               } else if (status === 'pending') {
                    NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_PAYMENT_PENDING', { supplierId }, actor).catch(() => { });
                    NotificationDispatcher.dispatch(tenantId, 'PAYMENT_PENDING', { supplierId }, actor).catch(() => { });
               } else if (status === 'refunded') {
                    NotificationDispatcher.dispatch(tenantId, 'PAYMENT_REVERSED', { supplierId }, actor).catch(() => { });
               }

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment updated successfully',
                    data: payment
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error updating supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to update supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async approve(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const id = req.params.id as string;
               const { approved_by, branchid: bodyBranchId } = req.body;

               if (!approved_by || typeof approved_by !== "number" || isNaN(approved_by)) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Approved by is required',
                         data: null
                    };
                    res.status(400).json(response);
                    return;
               }

               const payment = await model.approve(id, approved_by);

               if (!payment) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Supplier payment not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               let branchid = bodyBranchId;
               if (!branchid || typeof branchid !== "number" || isNaN(branchid)) {
                    const connection = await KnexConnection(tenantId);
                    const actor = await connection('roles')
                         .select('branch')
                         .where({ employeeid: approved_by })
                         .first();
                    branchid = actor?.branch;

                    if (!branchid) {
                         const fallbackBranch = await connection('branch')
                              .select('branchid')
                              .first();
                         branchid = fallbackBranch?.branchid;
                    }
               }

               let expenseSync: any = null;
               try {
                    if (branchid) {
                         expenseSync = await SupplierPaymentExpenseSync.markSupplierPaymentAsExpense(tenantId, {
                              paymentId: id,
                              employeeid: approved_by,
                              branchid
                         });
                    } else {
                         expenseSync = { success: false, message: 'Branch ID not available for expense sync' };
                    }
               } catch (syncErr: any) {
                    expenseSync = { success: false, message: syncErr?.message || 'Expense sync failed' };
               }

               NotificationDispatcher.dispatch(
                    tenantId,
                    'SUPPLIER_PAYMENT_PROCESSED',
                    { supplierId: (payment as any).supplier_id || id },
                    Number(approved_by) || undefined,
               ).catch(() => { });
               NotificationDispatcher.dispatch(
                    tenantId,
                    'PAYMENT_CONFIRMED',
                    { supplierId: (payment as any).supplier_id || id },
                    Number(approved_by) || undefined,
               ).catch(() => { });

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment approved successfully',
                    data: { payment, expenseSync }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error approving supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to approve supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async cancel(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const id = req.params.id as string;
               const payment = await model.cancel(id);

               if (payment) {
                    NotificationDispatcher.dispatch(
                         tenantId,
                         'PAYMENT_REVERSED',
                         { supplierId: (payment as any).supplier_id || id },
                    ).catch(() => { });
               }

               if (!payment) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Supplier payment not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment cancelled successfully',
                    data: payment
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error cancelling supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to cancel supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async reject(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const { id } = req.params;
               const { rejected_by, rejection_reason } = req.body;

               if (!rejected_by || typeof rejected_by !== "number" || isNaN(rejected_by)) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Rejected by is required and must be a valid employee ID',
                         data: null
                    };
                    res.status(400).json(response);
                    return;
               }

               const payment = await model.reject(id, rejected_by, rejection_reason);

               if (!payment) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Supplier payment not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               NotificationDispatcher.dispatch(
                    tenantId,
                    'SUPPLIER_PAYMENT_FAILED',
                    { supplierId: (payment as any).supplier_id || id },
                    Number(rejected_by) || undefined,
               ).catch(() => { });
               NotificationDispatcher.dispatch(
                    tenantId,
                    'PAYMENT_FAILED',
                    { supplierId: (payment as any).supplier_id || id },
                    Number(rejected_by) || undefined,
               ).catch(() => { });

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier payment rejected successfully',
                    data: payment
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error rejecting supplier payment:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to reject supplier payment',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async addAllocation(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const { id } = req.params;

               const validation = this.validateAllocationRequest(req.body);
               if (!validation.isValid) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Validation failed',
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Validation failed',
                              details: validation.errors
                         },
                         data: null
                    };
                    res.status(400).json(response);
                    return;
               }

               const allocation = await model.addAllocation(id, req.body as CreateSupplierPaymentAllocationRequest);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Payment allocation added successfully',
                    data: allocation
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error adding payment allocation:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to add payment allocation',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async removeAllocation(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);
               const { allocationId } = req.params;

               await model.removeAllocation(allocationId);

               const response: ApiResponse<null> = {
                    success: true,
                    message: 'Payment allocation removed successfully',
                    data: null
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error removing payment allocation:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to remove payment allocation',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async getSummary(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const model = new SupplierPaymentModel(tenantId);

               const filters: SupplierPaymentFilters = {
                    supplier_id: req.query.supplier_id as string,
                    startDate: req.query.startDate as string,
                    endDate: req.query.endDate as string
               };

               const summary = await model.getPaymentSummary(filters);

               const response: ApiResponse<SupplierPaymentSummary> = {
                    success: true,
                    message: 'Payment summary retrieved successfully',
                    data: summary
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving payment summary:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve payment summary',
                    data: null
               };
               res.status(500).json(response);
          }
     }
}
