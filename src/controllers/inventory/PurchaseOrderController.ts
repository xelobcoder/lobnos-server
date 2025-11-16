import { Request, Response } from 'express';
import { PurchaseOrderModel } from '../../models/inventory';
import { SupplierPaymentModel } from '../../models/inventory';
import {
     CreatePurchaseOrderRequest,
     UpdatePurchaseOrderRequest,
     PurchaseOrderListResponse,
     ReceiveOrderRequest,
     ApiResponse,
     ValidationError,
     PurchaseOrderFilters
} from '../../models/inventory/types';

export class PurchaseOrderController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private validateCreatePurchaseOrderRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (!data.supplier_id || typeof data.supplier_id !== 'string') {
               errors.push({
                    field: 'supplier_id',
                    message: 'Supplier ID is required',
                    value: data.supplier_id
               });
          }

          if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
               errors.push({
                    field: 'items',
                    message: 'At least one item is required',
                    value: data.items
               });
          } else {
               data.items.forEach((item: any, index: number) => {
                    if (!item.inventory_item_id || typeof item.inventory_item_id !== 'string') {
                         errors.push({
                              field: `items[${index}].inventory_item_id`,
                              message: 'Inventory item ID is required',
                              value: item.inventory_item_id
                         });
                    }

                    if (!item.quantity_ordered || typeof item.quantity_ordered !== 'number' || item.quantity_ordered <= 0) {
                         errors.push({
                              field: `items[${index}].quantity_ordered`,
                              message: 'Quantity ordered must be a positive number',
                              value: item.quantity_ordered
                         });
                    }

                    if (item.unit_price !== undefined && (typeof item.unit_price !== 'number' || item.unit_price < 0)) {
                         errors.push({
                              field: `items[${index}].unit_price`,
                              message: 'Unit price must be a non-negative number',
                              value: item.unit_price
                         });
                    }

                    if (item.tax_rate !== undefined && (typeof item.tax_rate !== 'number' || item.tax_rate < 0 || item.tax_rate > 100)) {
                         errors.push({
                              field: `items[${index}].tax_rate`,
                              message: 'Tax rate must be a number between 0 and 100',
                              value: item.tax_rate
                         });
                    }

                    if (item.discount_rate !== undefined && (typeof item.discount_rate !== 'number' || item.discount_rate < 0 || item.discount_rate > 100)) {
                         errors.push({
                              field: `items[${index}].discount_rate`,
                              message: 'Discount rate must be a number between 0 and 100',
                              value: item.discount_rate
                         });
                    }
               });
          }

          if (data.expected_delivery_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.expected_delivery_date)) {
               errors.push({
                    field: 'expected_delivery_date',
                    message: 'Expected delivery date must be in YYYY-MM-DD format',
                    value: data.expected_delivery_date
               });
          }

          return { isValid: errors.length === 0, errors };
     }

     private validateUpdatePurchaseOrderRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (data.supplier_id && typeof data.supplier_id !== 'string') {
               errors.push({
                    field: 'supplier_id',
                    message: 'Supplier ID must be a string',
                    value: data.supplier_id
               });
          }

          if (data.expected_delivery_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.expected_delivery_date)) {
               errors.push({
                    field: 'expected_delivery_date',
                    message: 'Expected delivery date must be in YYYY-MM-DD format',
                    value: data.expected_delivery_date
               });
          }

          if (data.status && !['ordered', 'partially_received', 'received', 'cancelled'].includes(data.status)) {
               errors.push({
                    field: 'status',
                    message: 'Status must be one of: ordered, partially_received, received, cancelled',
                    value: data.status
               });
          }

          return { isValid: errors.length === 0, errors };
     }

     private validateReceiveOrderRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (!data.receipts || !Array.isArray(data.receipts) || data.receipts.length === 0) {
               errors.push({
                    field: 'receipts',
                    message: 'At least one receipt is required',
                    value: data.receipts
               });
          } else {
               data.receipts.forEach((receipt: any, index: number) => {
                    if (!receipt.order_item_id || typeof receipt.order_item_id !== 'string') {
                         errors.push({
                              field: `receipts[${index}].order_item_id`,
                              message: 'Order item ID is required',
                              value: receipt.order_item_id
                         });
                    }

                    if (!receipt.quantity_received || typeof receipt.quantity_received !== 'number' || receipt.quantity_received <= 0) {
                         errors.push({
                              field: `receipts[${index}].quantity_received`,
                              message: 'Quantity received must be a positive number',
                              value: receipt.quantity_received
                         });
                    }

                    if (receipt.condition_status && !['good', 'acceptable', 'damaged', 'expired'].includes(receipt.condition_status)) {
                         errors.push({
                              field: `receipts[${index}].condition_status`,
                              message: 'Condition status must be one of: good, acceptable, damaged, expired',
                              value: receipt.condition_status
                         });
                    }

                    if (receipt.quality_check_passed !== undefined && typeof receipt.quality_check_passed !== 'boolean') {
                         errors.push({
                              field: `receipts[${index}].quality_check_passed`,
                              message: 'Quality check passed must be a boolean',
                              value: receipt.quality_check_passed
                         });
                    }
               });
          }

          return { isValid: errors.length === 0, errors };
     }

     async createPurchaseOrder(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const requestData: CreatePurchaseOrderRequest = req.body;

               const validation = this.validateCreatePurchaseOrderRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Invalid purchase order data',
                              details: validation.errors
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const purchaseOrder = await purchaseOrderModel.create(requestData);

               const orderWithPayments = {
                    ...purchaseOrder,
                    payment_history: [],
                    total_paid: 0,
                    total_pending: 0,
                    remaining_balance: purchaseOrder.total_amount
               };

               const response: ApiResponse = {
                    success: true,
                    data: orderWithPayments
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error creating purchase order:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to create purchase order'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getPurchaseOrderById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const purchaseOrder = await purchaseOrderModel.findById(id);

               if (!purchaseOrder) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Purchase order not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const supplierPaymentModel = new SupplierPaymentModel(tenantId);
               try {
                    const paymentResult = await supplierPaymentModel.findMany({
                         purchase_order_id: purchaseOrder.id,
                         page: 1,
                         count: 1000,
                         sortby: 'DESC'
                    });

                    const payments = paymentResult.payments || [];

                    const totalPaid = payments
                         .filter(payment => payment.payment_status === 'completed')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const totalPending = payments
                         .filter(payment => payment.payment_status === 'pending')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const remainingBalance = purchaseOrder.total_amount - totalPaid;

                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: payments,
                         total_paid: totalPaid,
                         total_pending: totalPending,
                         remaining_balance: remainingBalance
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               } catch (paymentError) {
                    console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: [],
                         total_paid: 0,
                         total_pending: 0,
                         remaining_balance: purchaseOrder.total_amount
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               }
          } catch (error: any) {
               console.error('Error fetching purchase order:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch purchase order'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getPurchaseOrders(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    page = '1',
                    count = '10',
                    supplier_id,
                    order_id,
                    status,
                    start_date,
                    end_date,
                    search,
                    sortby = 'DESC'
               } = req.query;

               const filters: PurchaseOrderFilters = {
                    page: parseInt(page as string, 10),
                    count: parseInt(count as string, 10),
                    supplier_id: supplier_id as string,
                    order_id: order_id as string,
                    status: status as any,
                    start_date: start_date as string,
                    end_date: end_date as string,
                    search: search as string,
                    sortby: (sortby as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
               };

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const result: PurchaseOrderListResponse = await purchaseOrderModel.findMany(filters);

               const supplierPaymentModel = new SupplierPaymentModel(tenantId);
               const ordersWithPayments = await Promise.all(
                    result.orders.map(async (order) => {
                         try {
                              const paymentResult = await supplierPaymentModel.findMany({
                                   purchase_order_id: order.id,
                                   page: 1,
                                   count: 1000,
                                   sortby: 'DESC'
                              });

                              const payments = paymentResult.payments || [];

                              const totalPaid = payments
                                   .filter(payment => payment.payment_status === 'completed')
                                   .reduce((sum, payment) => sum + payment.payment_amount, 0);

                              const totalPending = payments
                                   .filter(payment => payment.payment_status === 'pending')
                                   .reduce((sum, payment) => sum + payment.payment_amount, 0);

                              const remainingBalance = order.total_amount - totalPaid;

                              return {
                                   ...order,
                                   payment_history: payments,
                                   total_paid: totalPaid,
                                   total_pending: totalPending,
                                   remaining_balance: remainingBalance
                              };
                         } catch (error) {
                              console.warn(`Failed to fetch payments for order ${order.id}:`, error);
                              return {
                                   ...order,
                                   payment_history: [],
                                   total_paid: 0,
                                   total_pending: 0,
                                   remaining_balance: order.total_amount
                              };
                         }
                    })
               );

               const response: ApiResponse = {
                    success: true,
                    data: ordersWithPayments,
                    pagination: {
                         page: result.page,
                         count: result.count,
                         total: result.total,
                         totalPages: result.totalPages,
                         sortby: result.sortby
                    }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching purchase orders:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch purchase orders'
                    }
               };

               res.status(500).json(response);
          }
     }

     async updatePurchaseOrder(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;
               const requestData: UpdatePurchaseOrderRequest = req.body;

               const validation = this.validateUpdatePurchaseOrderRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Invalid purchase order data',
                              details: validation.errors
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const purchaseOrder = await purchaseOrderModel.update(id, requestData);

               if (!purchaseOrder) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Purchase order not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const supplierPaymentModel = new SupplierPaymentModel(tenantId);
               try {
                    const paymentResult = await supplierPaymentModel.findMany({
                         purchase_order_id: purchaseOrder.id,
                         page: 1,
                         count: 1000,
                         sortby: 'DESC'
                    });

                    const payments = paymentResult.payments || [];
                    const totalPaid = payments
                         .filter(payment => payment.payment_status === 'completed')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const totalPending = payments
                         .filter(payment => payment.payment_status === 'pending')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: payments,
                         total_paid: totalPaid,
                         total_pending: totalPending,
                         remaining_balance: purchaseOrder.total_amount - totalPaid
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               } catch (paymentError) {
                    console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: [],
                         total_paid: 0,
                         total_pending: 0,
                         remaining_balance: purchaseOrder.total_amount
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               }
          } catch (error: any) {
               console.error('Error updating purchase order:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to update purchase order'
                    }
               };

               res.status(500).json(response);
          }
     }

     async cancelPurchaseOrder(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const purchaseOrder = await purchaseOrderModel.cancel(id);

               if (!purchaseOrder) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Purchase order not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const supplierPaymentModel = new SupplierPaymentModel(tenantId);
               try {
                    const paymentResult = await supplierPaymentModel.findMany({
                         purchase_order_id: purchaseOrder.id,
                         page: 1,
                         count: 1000,
                         sortby: 'DESC'
                    });

                    const payments = paymentResult.payments || [];
                    const totalPaid = payments
                         .filter(payment => payment.payment_status === 'completed')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const totalPending = payments
                         .filter(payment => payment.payment_status === 'pending')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: payments,
                         total_paid: totalPaid,
                         total_pending: totalPending,
                         remaining_balance: purchaseOrder.total_amount - totalPaid
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               } catch (paymentError) {
                    console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: [],
                         total_paid: 0,
                         total_pending: 0,
                         remaining_balance: purchaseOrder.total_amount
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               }
          } catch (error: any) {
               console.error('Error cancelling purchase order:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to cancel purchase order'
                    }
               };

               res.status(500).json(response);
          }
     }

     async receivePurchaseOrder(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;
               const requestData: ReceiveOrderRequest = req.body;

               const validation = this.validateReceiveOrderRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Invalid receipt data',
                              details: validation.errors
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const purchaseOrder = await purchaseOrderModel.receiveOrder(id, requestData);

               const supplierPaymentModel = new SupplierPaymentModel(tenantId);
               try {
                    const paymentResult = await supplierPaymentModel.findMany({
                         purchase_order_id: purchaseOrder.id,
                         page: 1,
                         count: 1000,
                         sortby: 'DESC'
                    });

                    const payments = paymentResult.payments || [];
                    const totalPaid = payments
                         .filter(payment => payment.payment_status === 'completed')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const totalPending = payments
                         .filter(payment => payment.payment_status === 'pending')
                         .reduce((sum, payment) => sum + payment.payment_amount, 0);

                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: payments,
                         total_paid: totalPaid,
                         total_pending: totalPending,
                         remaining_balance: purchaseOrder.total_amount - totalPaid
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               } catch (paymentError) {
                    console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                    const orderWithPayments = {
                         ...purchaseOrder,
                         payment_history: [],
                         total_paid: 0,
                         total_pending: 0,
                         remaining_balance: purchaseOrder.total_amount
                    };

                    const response: ApiResponse = {
                         success: true,
                         data: orderWithPayments
                    };

                    res.json(response);
               }
          } catch (error: any) {
               console.error('Error processing purchase order receipt:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to process purchase order receipt'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getPurchaseOrderItems(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const orderExists = await purchaseOrderModel.findById(id);

               if (!orderExists) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Purchase order not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const items = await purchaseOrderModel.getOrderItems(id);

               const response: ApiResponse = {
                    success: true,
                    data: items
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching purchase order items:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch purchase order items'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getReceivedOrdersReport(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    page = '1',
                    count = '10',
                    startDate,
                    endDate,
                    supplier_id,
                    sortby = 'DESC'
               } = req.query;

               const purchaseOrderModel = new PurchaseOrderModel(tenantId);
               const result = await purchaseOrderModel.getReceivedOrdersReport({
                    page: parseInt(page as string, 10),
                    count: parseInt(count as string, 10),
                    supplier_id: supplier_id as string,
                    start_date: startDate as string,
                    end_date: endDate as string,
                    sortby: (sortby as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
               });

               const supplierPaymentModel = new SupplierPaymentModel(tenantId);
               const ordersWithPayments = await Promise.all(
                    result.orders.map(async (order) => {
                         try {
                              const paymentResult = await supplierPaymentModel.findMany({
                                   purchase_order_id: order.id,
                                   page: 1,
                                   count: 1000,
                                   sortby: 'DESC'
                              });

                              const payments = paymentResult.payments || [];
                              const totalPaid = payments
                                   .filter(payment => payment.payment_status === 'completed')
                                   .reduce((sum, payment) => sum + payment.payment_amount, 0);

                              const totalPending = payments
                                   .filter(payment => payment.payment_status === 'pending')
                                   .reduce((sum, payment) => sum + payment.payment_amount, 0);

                              return {
                                   ...order,
                                   payment_history: payments,
                                   total_paid: totalPaid,
                                   total_pending: totalPending,
                                   remaining_balance: order.total_amount - totalPaid
                              };
                         } catch (error) {
                              console.warn(`Failed to fetch payments for order ${order.id}:`, error);
                              return {
                                   ...order,
                                   payment_history: [],
                                   total_paid: 0,
                                   total_pending: 0,
                                   remaining_balance: order.total_amount
                              };
                         }
                    })
               );

               const response: ApiResponse = {
                    success: true,
                    data: ordersWithPayments,
                    pagination: {
                         page: result.page,
                         count: result.count,
                         total: result.total,
                         totalPages: result.totalPages,
                         sortby: result.sortby
                    }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching received orders report:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch received orders report'
                    }
               };

               res.status(500).json(response);
          }
     }
}