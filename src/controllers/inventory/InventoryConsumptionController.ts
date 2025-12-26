import { Request, Response } from 'express';
import { InventoryTransactionModel } from '../../models/inventory/InventoryTransaction';
import { InventoryItemModel } from '../../models/inventory/InventoryItem';
import {
     CreateInventoryTransactionRequest,
     InventoryTransactionFilters,
     ApiResponse,
     ConsumptionReportResponse,
     ConsumptionSummary
} from '../../models/inventory/types';
import { InventoryTemplateModel } from '../../models/inventory';

export class InventoryConsumptionController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private getModel(req: Request): InventoryTransactionModel {
          const tenantId = this.getTenantId(req);
          return new InventoryTransactionModel(tenantId);
     }

     private async validateBatchStockAvailability(tenantId: number, itemId: string, batchNumber: string, requestedQuantity: number): Promise<{ isValid: boolean; availableQuantity: number; message?: string }> {
          try {
               const model = new InventoryTransactionModel(tenantId);
               const stockDetails = await model.getAvailableStockDetails(itemId);

               const batchInfo = stockDetails.available_batches.find(b => b.batch_number === batchNumber);

               if (!batchInfo) {
                    return {
                         isValid: false,
                         availableQuantity: 0,
                         message: `Batch ${batchNumber} not found or has no available stock`
                    };
               }

               if (batchInfo.available_quantity < requestedQuantity) {
                    return {
                         isValid: false,
                         availableQuantity: batchInfo.available_quantity,
                         message: `Insufficient stock in batch. Requested: ${requestedQuantity}, Available: ${batchInfo.available_quantity}`
                    };
               }

               return {
                    isValid: true,
                    availableQuantity: batchInfo.available_quantity
               };
          } catch (error) {
               console.error('Error validating batch stock:', error);
               return {
                    isValid: false,
                    availableQuantity: 0,
                    message: 'Error checking batch stock availability'
               };
          }
     }

     private async validateStockAvailability(tenantId: number, itemId: string, requestedQuantity: number): Promise<{ isValid: boolean; currentStock: number; message?: string }> {
          try {
               const itemModel = new InventoryItemModel(tenantId);
               const item = await itemModel.findById(itemId);

               if (!item) {
                    return {
                         isValid: false,
                         currentStock: 0,
                         message: `Item ${itemId} not found`
                    };
               }

               if (item.current_stock < requestedQuantity) {
                    return {
                         isValid: false,
                         currentStock: item.current_stock,
                         message: `Insufficient stock. Requested: ${requestedQuantity}, Available: ${item.current_stock}`
                    };
               }

               return {
                    isValid: true,
                    currentStock: item.current_stock
               };
          } catch (error) {
               console.error('Error validating stock availability:', error);
               return {
                    isValid: false,
                    currentStock: 0,
                    message: 'Error checking stock availability'
               };
          }
     }

     private async createConsumptionHistoryRecord(tenantId: number, consumptionData: {
          item_id: string;
          quantity_consumed: number;
          consumed_by?: string;
          consumption_date?: Date;
          batch_number?: string;
          brand_name?: string;
          unit_cost?: number;
          total_cost?: number;
          consumption_reason?: string;
          department?: string;
          patientid?: string;
          prescription_id?: string;
          notes?: string;
          approved_by?: string;
     }): Promise<string> {
          const model = new InventoryTransactionModel(tenantId);
          const connection = await (model as any).connection;

          const consumptionHistoryId = `CH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          let unitCost = consumptionData.unit_cost || 0;
          let totalCost = consumptionData.total_cost || 0;

          if (unitCost === 0 || totalCost === 0) {
               if (consumptionData.batch_number) {
                    const batchReceipt = await connection('inv_purchase_order_receipts')
                         .join('inv_purchase_order_items', 'inv_purchase_order_receipts.order_item_id', 'inv_purchase_order_items.id')
                         .where('inv_purchase_order_receipts.batch_number', consumptionData.batch_number)
                         .andWhere('inv_purchase_order_items.inventory_item_id', consumptionData.item_id)
                         .select('inv_purchase_order_receipts.unit_price')
                         .orderBy('inv_purchase_order_receipts.received_date', 'desc')
                         .first();

                    if (batchReceipt && batchReceipt.unit_price) {
                         unitCost = parseFloat(batchReceipt.unit_price);
                         totalCost = unitCost * consumptionData.quantity_consumed;
                    }
               }

               if (unitCost === 0) {
                    const recentTransaction = await connection('inv_inventory_transactions')
                         .where('item_id', consumptionData.item_id)
                         .andWhere('unit_cost', '>', 0)
                         .select('unit_cost')
                         .orderBy('transaction_date', 'desc')
                         .first();

                    if (recentTransaction && recentTransaction.unit_cost) {
                         unitCost = parseFloat(recentTransaction.unit_cost);
                         totalCost = unitCost * consumptionData.quantity_consumed;
                    }
               }
          }

          await connection('inv_consumption_history').insert({
               id: consumptionHistoryId,
               item_id: consumptionData.item_id,
               quantity_consumed: consumptionData.quantity_consumed,
               consumed_by: consumptionData.consumed_by,
               consumption_date: consumptionData.consumption_date || new Date(),
               batch_number: consumptionData.batch_number,
               brand_name: consumptionData.brand_name,
               unit_cost: unitCost,
               total_cost: totalCost,
               consumption_reason: consumptionData.consumption_reason,
               department: consumptionData.department,
               patientid: consumptionData.patientid,
               prescription_id: consumptionData.prescription_id,
               notes: consumptionData.notes,
               approved_by: consumptionData.approved_by
          });

          return consumptionHistoryId;
     }

     private validateConsumptionRequest(data: any): { isValid: boolean; errors: string[] } {
          const errors: string[] = [];

          if (!data.item_id || typeof data.item_id !== 'string') {
               errors.push('Item ID is required and must be a string');
          }

          if (!data.quantity || typeof data.quantity !== 'number' || data.quantity <= 0) {
               errors.push('Quantity must be a positive number');
          }
          return { isValid: errors.length === 0, errors };
     }

     private determineConsumptionType(transaction: any): 'manual' | 'test' | 'wastage' {
          if (transaction.transaction_type === 'wastage') return 'wastage';
          if ((transaction.reason || '').toLowerCase().includes('test')) return 'test';
          return 'manual';
     }

     private determineConsumptionTypeFromHistory(consumption: any): 'manual' | 'test' | 'wastage' {
          const reason = (consumption.consumption_reason || '').toLowerCase();
          if (reason.includes('wastage')) return 'wastage';
          if (reason.includes('test')) return 'test';
          return 'manual';
     }

     private async validateNoDuplicateWastage(tenantId: number, itemId: string, batchNumber?: string, wastageType?: string, reason?: string): Promise<{ isValid: boolean; message?: string }> {
          const model = new InventoryTransactionModel(tenantId);

          try {
               const filters: any = {
                    transaction_type: 'wastage',
                    count: 1
               };

               if (batchNumber) {
                    filters.batch_number = batchNumber;
               }

               const existingWastage = await model.findByItemId(itemId, filters);

               const matchingWastage = existingWastage.transactions.filter((transaction: any) => {
                    const existingReason = (transaction.reason || '').toLowerCase();
                    const existingWastageType = (transaction.wastage_type || '').toLowerCase();
                    const currentReason = (reason || '').toLowerCase();
                    const currentWastageType = (wastageType || '').toLowerCase();

                    return existingWastageType === currentWastageType ||
                         (existingReason.includes('expired') && currentReason.includes('expired')) ||
                         (existingReason.includes('damage') && currentReason.includes('damage')) ||
                         (existingReason.includes('broken') && currentReason.includes('broken'));
               });

               if (matchingWastage.length > 0) {
                    const wastageTransaction = matchingWastage[0];
                    return {
                         isValid: false,
                         message: `This ${batchNumber ? `batch (${batchNumber})` : 'item'} has already been consumed as wastage (${wastageType || reason || 'N/A'}) on ${new Date(wastageTransaction.transaction_date).toLocaleDateString()}`
                    };
               }

               return { isValid: true };
          } catch (error) {
               console.error('Error checking for duplicate wastage:', error);
               return { isValid: true };
          }
     }

     async recordTestConsumption(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const consumptions = req.body.consumptions;
               if (Array.isArray(consumptions) == false) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Consumptions must be an array'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               let errors: string[] = [];

               for (const consumptionEntry of consumptions) {
                    const { test_id, item_id, quantity_used, test_type, patient_id, ascension_id, testid, batch_number, brand_name, performed_by, notes } = consumptionEntry;
                    const validation = this.validateConsumptionRequest({ item_id, quantity: quantity_used });
                    if (!validation.isValid) {
                         errors = errors.concat(validation.errors.map(err => `Test ID ${test_id || 'N/A'}: ${err}`));
                    }

                    if (!test_id || !item_id || !quantity_used || !test_type || !patient_id || !ascension_id || !performed_by) {
                         errors.push(`Test ID ${test_id || 'N/A'}: Missing required fields: test_id, item_id, quantity_used, test_type, patient_id, ascension_id, performed_by`);
                         continue;
                    }
               }

               if (errors.length > 0) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: errors.join(', ')
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const tenantId = this.getTenantId(req);

               const stockValidationErrors: string[] = [];
               for (const consumptionEntry of consumptions) {
                    const { test_id, item_id, quantity_used, batch_number } = consumptionEntry;

                    const stockCheck = await this.validateStockAvailability(tenantId, item_id, quantity_used);
                    if (!stockCheck.isValid) {
                         stockValidationErrors.push(`Test ID ${test_id}: Item ${item_id}: ${stockCheck.message}`);
                    }

                    if (batch_number) {
                         const batchStockCheck = await this.validateBatchStockAvailability(tenantId, item_id, batch_number, quantity_used);
                         if (!batchStockCheck.isValid) {
                              stockValidationErrors.push(`Test ID ${test_id}: Batch ${batch_number} for item ${item_id}: ${batchStockCheck.message}`);
                         }
                    }
               }

               if (stockValidationErrors.length > 0) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'INSUFFICIENT_STOCK',
                              message: `Stock validation failed: ${stockValidationErrors.join('; ')}`
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const duplicateValidationErrors: string[] = [];
               let unConsumedItems: any[] = [];
               const connection = await (model as any).connection;

               for (const consumptionEntry of consumptions) {
                    const { test_id, item_id, ascension_id } = consumptionEntry;

                    const existingTransaction = await connection('inv_inventory_transactions')
                         .where('item_id', item_id)
                         .andWhere('ascension_id', ascension_id)
                         .andWhere('transaction_type', 'consumption')
                         .first();

                    if (existingTransaction) {
                         duplicateValidationErrors.push(`Test ID ${test_id}: Item ${item_id} has already been consumed for ascension ${ascension_id} on ${new Date(existingTransaction.transaction_date).toLocaleDateString()}`);
                    } else {
                         unConsumedItems.push(consumptionEntry);
                    }
               }



               for (const consumptionEntry of unConsumedItems) {
                    const { test_id, item_id, quantity_used, test_type, patientid, ascensionid, testid, batch_number, brand_name, performed_by, notes } = consumptionEntry;

                    // If batch_number is provided, use it directly
                    if (batch_number) {
                         let expiry_date: string | undefined;

                         const stockDetails = await model.getAvailableStockDetails(item_id);
                         const batchInfo = stockDetails.available_batches.find(b => b.batch_number === batch_number);
                         if (batchInfo) {
                              expiry_date = batchInfo.expiry_date;
                         }

                         const consumptionHistoryId = await this.createConsumptionHistoryRecord(tenantId, {
                              item_id,
                              quantity_consumed: quantity_used,
                              consumed_by: performed_by?.toString(),
                              consumption_date: new Date(),
                              batch_number,
                              brand_name,
                              consumption_reason: `Test consumption - ${test_type}`,
                              department: 'laboratory',
                              patientid,
                              prescription_id: test_id,
                              notes: notes || `Automatic consumption for test ${test_id}`,
                              approved_by: performed_by?.toString()
                         });

                         const transactionData: CreateInventoryTransactionRequest = {
                              item_id,
                              transaction_type: 'consumption',
                              unit_type: 'consumption',
                              quantity: quantity_used,
                              reason: `Test consumption - ${test_type}`,
                              reference_id: consumptionHistoryId,
                              patientid,
                              ascensionid,
                              testid,
                              batch_number,
                              brand_name,
                              expiry_date,
                              performed_by,
                              notes: notes || `Automatic consumption for test ${test_id}`
                         };

                         await model.create(transactionData);
                    } else {
                         // FIFO: Automatically select batches when batch_number not provided
                         const stockDetails = await model.getAvailableStockDetails(item_id);

                         if (stockDetails.available_batches.length === 0) {
                              throw new Error(`No available batches found for FIFO consumption of item ${item_id} (Test ID: ${test_id})`);
                         }

                         const totalAvailableQuantity = stockDetails.available_batches.reduce((sum, batch) => sum + batch.available_quantity, 0);
                         if (totalAvailableQuantity < quantity_used) {
                              throw new Error(`Insufficient total stock for FIFO consumption. Test ID: ${test_id}, Item: ${item_id}, Requested: ${quantity_used}, Available: ${totalAvailableQuantity}`);
                         }

                         let remainingQuantity = quantity_used;
                         const batchesToConsume: Array<{ batch_number: string; brand_name?: string; expiry_date?: string; quantity: number }> = [];

                         for (const batch of stockDetails.available_batches) {
                              if (remainingQuantity <= 0) break;

                              const consumeFromBatch = Math.min(remainingQuantity, batch.available_quantity);
                              batchesToConsume.push({
                                   batch_number: batch.batch_number,
                                   brand_name: batch.brand_name,
                                   expiry_date: batch.expiry_date,
                                   quantity: consumeFromBatch
                              });

                              remainingQuantity -= consumeFromBatch;
                         }

                         // Process each batch consumption
                         for (const batchConsumption of batchesToConsume) {
                              const consumptionHistoryId = await this.createConsumptionHistoryRecord(tenantId, {
                                   item_id,
                                   quantity_consumed: batchConsumption.quantity,
                                   consumed_by: performed_by?.toString(),
                                   consumption_date: new Date(),
                                   batch_number: batchConsumption.batch_number,
                                   brand_name: batchConsumption.brand_name,
                                   consumption_reason: `Test consumption - ${test_type}`,
                                   department: 'laboratory',
                                   patientid: patientid,
                                   prescription_id: test_id,
                                   notes: notes || `FIFO automatic consumption for test ${test_id} from batch ${batchConsumption.batch_number} (${batchConsumption.quantity} units)`,
                                   approved_by: performed_by?.toString()
                              });

                              const transactionData: CreateInventoryTransactionRequest = {
                                   item_id,
                                   transaction_type: 'consumption',
                                   unit_type: 'consumption',
                                   quantity: batchConsumption.quantity,
                                   reason: `Test consumption - ${test_type}`,
                                   reference_id: consumptionHistoryId,
                                   patientid,
                                   ascensionid,
                                   testid,
                                   batch_number: batchConsumption.batch_number,
                                   brand_name: batchConsumption.brand_name,
                                   expiry_date: batchConsumption.expiry_date,
                                   performed_by,
                                   notes: notes || `FIFO automatic consumption for test ${test_id} from batch ${batchConsumption.batch_number} (${batchConsumption.quantity} units)`
                              };

                              await model.create(transactionData);
                         }
                    }
               }

               let message = `Successfully recorded consumption for ${unConsumedItems.length} test item(s)`;

               if (duplicateValidationErrors.length > 0) {
                    message += `. Skipped ${duplicateValidationErrors.length} item(s) due to duplicate consumption: ${duplicateValidationErrors.join('; ')}`;
               }

               const response: ApiResponse = {
                    success: true,
                    data: {
                         message
                    }
               };

               res.status(201).json(response);
          } catch (error: any) {
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to record test consumption'
                    }
               };
               res.status(500).json(response);
          }


     }

     async recordWastage(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { item_id, quantity, reason, batch_number, brand_name, performed_by, notes } = req.body;
               const tenantId = this.getTenantId(req);

               if (!item_id || !quantity || !reason) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Missing required fields: item_id, quantity, reason'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const validation = this.validateConsumptionRequest({ item_id, quantity });
               if (!validation.isValid) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: validation.errors.join(', ')
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const stockCheck = await this.validateStockAvailability(tenantId, item_id, quantity);
               if (!stockCheck.isValid) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'INSUFFICIENT_STOCK',
                              message: stockCheck.message || 'Insufficient stock available'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const duplicateCheck = await this.validateNoDuplicateWastage(tenantId, item_id, batch_number, undefined, reason);
               if (!duplicateCheck.isValid) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'DUPLICATE_WASTAGE',
                              message: duplicateCheck.message
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               let expiry_date: string | undefined;
               if (batch_number) {
                    const stockDetails = await model.getAvailableStockDetails(item_id);
                    const batchInfo = stockDetails.available_batches.find(b => b.batch_number === batch_number);
                    if (batchInfo) {
                         expiry_date = batchInfo.expiry_date;
                    }
               }

               const consumptionHistoryId = await this.createConsumptionHistoryRecord(tenantId, {
                    item_id,
                    quantity_consumed: quantity,
                    consumed_by: performed_by?.toString(),
                    consumption_date: new Date(),
                    batch_number,
                    brand_name,
                    consumption_reason: `Wastage - ${reason}`,
                    department: 'inventory',
                    notes,
                    approved_by: performed_by?.toString()
               });

               const transactionData: CreateInventoryTransactionRequest = {
                    item_id,
                    transaction_type: 'wastage',
                    unit_type: 'consumption',
                    quantity,
                    reason: `Wastage - ${reason}`,
                    reference_id: consumptionHistoryId,
                    batch_number,
                    brand_name,
                    expiry_date,
                    performed_by,
                    notes
               };

               const transaction = await model.create(transactionData);

               const response: ApiResponse = {
                    success: true,
                    data: {
                         ...transaction,
                         stock_remaining: stockCheck.currentStock - quantity
                    }
               };
               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error recording wastage:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to record wastage'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getConsumptionTransactions(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const tenantId = this.getTenantId(req);
               const {
                    page = 1,
                    count = 10,
                    sortby = 'DESC',
                    item_id,
                    performed_by,
                    startDate,
                    endDate,
                    reason
               } = req.query;

               const connection = await (model as any).connection;
               const sortOrder = (sortby as string).toUpperCase() === 'ASC' ? 'asc' : 'desc';

               let query = connection('inv_consumption_history')
                    .leftJoin('inv_inventory_items', 'inv_consumption_history.item_id', 'inv_inventory_items.id')
                    .leftJoin('roles', 'inv_consumption_history.consumed_by', 'roles.employeeid')
                    .select(
                         'inv_consumption_history.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'roles.username',
                         'roles.email',
                         'roles.role as role_name',
                         'roles.employeeid as employee_id'
                    )
                    .orderBy('inv_consumption_history.consumption_date', sortOrder);

               if (item_id) {
                    query = query.where('inv_consumption_history.item_id', item_id);
               }
               if (performed_by) {
                    query = query.where('inv_consumption_history.consumed_by', performed_by);
               }
               if (startDate) {
                    query = query.where('inv_consumption_history.consumption_date', '>=', new Date(startDate as string));
               }
               if (endDate) {
                    query = query.where('inv_consumption_history.consumption_date', '<=', new Date(endDate as string + ' 23:59:59'));
               }
               if (reason) {
                    query = query.where('inv_consumption_history.consumption_reason', 'like', `%${reason}%`);
               }

               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult?.count as string) || 0;

               const offset = (parseInt(page as string) - 1) * parseInt(count as string);
               const rawData = await query.limit(parseInt(count as string)).offset(offset);

               const transactions = rawData.map(consumption => ({
                    id: consumption.id,
                    item_id: consumption.item_id,
                    item_name: consumption.item_name || '',
                    item_sku: consumption.item_sku || '',
                    transaction_type: 'consumption',
                    quantity: consumption.quantity_consumed,
                    previous_stock: null,
                    new_stock: null,
                    batch_number: consumption.batch_number,
                    expiry_date: null,
                    unit_cost: consumption.unit_cost,
                    total_cost: consumption.total_cost,
                    brand_name: consumption.brand_name,
                    reason: consumption.consumption_reason,
                    reference_id: consumption.id,
                    patientid: consumption.patientid,
                    ascensionid: null,
                    performed_by: consumption.consumed_by,
                    transaction_date: consumption.consumption_date,
                    notes: consumption.notes,
                    wastage_type: null,
                    created_at: consumption.consumption_date,
                    department: consumption.department,
                    prescription_id: consumption.prescription_id,
                    approved_by: consumption.approved_by,
                    consumed_by_details: {
                         employee_id: consumption.employee_id,
                         username: consumption.username,
                         email: consumption.email,
                         role_name: consumption.role_name
                    }
               }));

               const response: ApiResponse = {
                    success: true,
                    data: {
                         transactions,
                         total,
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         totalPages: Math.ceil(total / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC'
                    },
                    pagination: {
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         total,
                         totalPages: Math.ceil(total / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC'
                    }
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting consumption transactions:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get consumption transactions'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getConsumptionReport(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const tenantId = this.getTenantId(req);
               const {
                    page = 1,
                    count = 10,
                    sortby = 'DESC',
                    consumption_type,
                    item_id,
                    performed_by,
                    startDate,
                    endDate,
                    reason
               } = req.query;

               const connection = await (model as any).connection;
               const sortOrder = (sortby as string).toUpperCase() === 'ASC' ? 'asc' : 'desc';

               let query = connection('inv_consumption_history')
                    .leftJoin('inv_inventory_items', 'inv_consumption_history.item_id', 'inv_inventory_items.id')
                    .leftJoin('roles', 'inv_consumption_history.consumed_by', 'roles.employeeid')
                    .select(
                         'inv_consumption_history.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'roles.username',
                         'roles.email',
                         'roles.role as role_name',
                         'roles.employeeid as employee_id'
                    )
                    .orderBy('inv_consumption_history.consumption_date', sortOrder);

               if (item_id) {
                    query = query.where('inv_consumption_history.item_id', item_id);
               }
               if (performed_by) {
                    query = query.where('inv_consumption_history.consumed_by', performed_by);
               }
               if (startDate) {
                    query = query.where('inv_consumption_history.consumption_date', '>=', new Date(startDate as string));
               }
               if (endDate) {
                    query = query.where('inv_consumption_history.consumption_date', '<=', new Date(endDate as string + ' 23:59:59'));
               }
               if (reason) {
                    query = query.where('inv_consumption_history.consumption_reason', 'like', `%${reason}%`);
               }

               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult?.count as string) || 0;

               const offset = (parseInt(page as string) - 1) * parseInt(count as string);
               const rawData = await query.limit(parseInt(count as string)).offset(offset);

               let allConsumptionQuery = connection('inv_consumption_history')
                    .select('*')
                    .orderBy('consumption_date', sortOrder);

               if (item_id) {
                    allConsumptionQuery = allConsumptionQuery.where('item_id', item_id);
               }
               if (performed_by) {
                    allConsumptionQuery = allConsumptionQuery.where('consumed_by', performed_by);
               }
               if (startDate) {
                    allConsumptionQuery = allConsumptionQuery.where('consumption_date', '>=', new Date(startDate as string));
               }
               if (endDate) {
                    allConsumptionQuery = allConsumptionQuery.where('consumption_date', '<=', new Date(endDate as string + ' 23:59:59'));
               }
               if (reason) {
                    allConsumptionQuery = allConsumptionQuery.where('consumption_reason', 'like', `%${reason}%`);
               }

               const allConsumptionData = await allConsumptionQuery;

               const summary: ConsumptionSummary = {
                    total_consumptions: total,
                    manual_consumptions: allConsumptionData.filter(c => !c.consumption_reason?.toLowerCase().includes('test') && !c.consumption_reason?.toLowerCase().includes('wastage')).length,
                    test_consumptions: allConsumptionData.filter(c => c.consumption_reason?.toLowerCase().includes('test')).length,
                    wastage_consumptions: allConsumptionData.filter(c => c.consumption_reason?.toLowerCase().includes('wastage')).length,
                    total_quantity_consumed: allConsumptionData.reduce((sum, c) => sum + c.quantity_consumed, 0),
                    period_start: startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    period_end: endDate as string || new Date().toISOString().split('T')[0]
               };

               const consumptions = rawData.map(consumption => ({
                    id: consumption.id,
                    item_id: consumption.item_id,
                    item_name: consumption.item_name || '',
                    item_sku: consumption.item_sku || '',
                    consumption_type: this.determineConsumptionTypeFromHistory(consumption),
                    quantity: consumption.quantity_consumed,
                    reason: consumption.consumption_reason,
                    batch_number: consumption.batch_number,
                    patientid: consumption.patientid,
                    prescription_id: consumption.prescription_id,
                    performed_by: consumption.consumed_by,
                    transaction_date: consumption.consumption_date,
                    notes: consumption.notes,
                    department: consumption.department,
                    unit_cost: consumption.unit_cost,
                    total_cost: consumption.total_cost,
                    approved_by: consumption.approved_by,
                    consumed_by_details: {
                         employee_id: consumption.employee_id,
                         username: consumption.username,
                         email: consumption.email,
                         role_name: consumption.role_name
                    }
               }));

               const consumptionReport: ConsumptionReportResponse = {
                    consumptions,
                    total,
                    page: parseInt(page as string),
                    count: parseInt(count as string),
                    totalPages: Math.ceil(total / parseInt(count as string)),
                    sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC',
                    summary
               };

               const response: ApiResponse = {
                    success: true,
                    data: consumptionReport,
                    pagination: {
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         total,
                         totalPages: Math.ceil(total / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC'
                    }
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting consumption report:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get consumption report'
                    }
               };
               res.status(500).json(response);
          }
     }

     async consumeStockUnified(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { consumptions, item_id, quantity, transaction_type, wastage_type, reason, batch_number, brand_name, performed_by, notes } = req.body;
               const tenantId = this.getTenantId(req);

               const accepted_tranaction_type = ['consumption', 'wastage'];

               if (transaction_type && !accepted_tranaction_type.includes(transaction_type)) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: `Invalid transaction_type. Accepted values are: ${accepted_tranaction_type.join(', ')}`
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               let consumptionRequests: any[] = [];

               if (item_id && quantity !== undefined) {
                    consumptionRequests = [{
                         item_id,
                         quantity,
                         transaction_type: transaction_type || 'consumption',
                         wastage_type,
                         reason,
                         batch_number,
                         brand_name,
                         performed_by,
                         notes
                    }];
               }
               else if (consumptions && Array.isArray(consumptions)) {
                    consumptionRequests = consumptions.map(c => ({
                         ...c,
                         transaction_type: c.transaction_type || 'consumption',
                         wastage_type: c.wastage_type
                    }));
               }
               else {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Either provide single consumption (item_id, quantity) or bulk consumption (consumptions array)'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               for (const consumption of consumptionRequests) {
                    const validation = this.validateConsumptionRequest(consumption);
                    if (!validation.isValid) {
                         const response: ApiResponse = {
                              success: false,
                              error: {
                                   code: 'VALIDATION_ERROR',
                                   message: `Validation failed for item ${consumption.item_id}: ${validation.errors.join(', ')}`
                              }
                         };
                         res.status(400).json(response);
                         return;
                    }

                    if (consumption.transaction_type === 'wastage') {
                         const duplicateCheck = await this.validateNoDuplicateWastage(tenantId, consumption.item_id, consumption.batch_number, consumption.wastage_type, consumption.reason);
                         if (!duplicateCheck.isValid) {
                              const response: ApiResponse = {
                                   success: false,
                                   error: {
                                        code: 'DUPLICATE_WASTAGE',
                                        message: duplicateCheck.message
                                   }
                              };
                              res.status(400).json(response);
                              return;
                         }
                    }

                    const stockCheck = await this.validateStockAvailability(tenantId, consumption.item_id, consumption.quantity);
                    if (!stockCheck.isValid) {
                         const response: ApiResponse = {
                              success: false,
                              error: {
                                   code: 'INSUFFICIENT_STOCK',
                                   message: `Item ${consumption.item_id}: ${stockCheck.message}`
                              }
                         };
                         res.status(400).json(response);
                         return;
                    }

                    if (consumption.batch_number) {
                         const batchStockCheck = await this.validateBatchStockAvailability(tenantId, consumption.item_id, consumption.batch_number, consumption.quantity);
                         if (!batchStockCheck.isValid) {
                              const response: ApiResponse = {
                                   success: false,
                                   error: {
                                        code: 'INSUFFICIENT_BATCH_STOCK',
                                        message: `Batch ${consumption.batch_number} for item ${consumption.item_id}: ${batchStockCheck.message}`
                                   }
                              };
                              res.status(400).json(response);
                              return;
                         }
                    }
               }

               const results = [];
               for (const consumption of consumptionRequests) {
                    if (consumption.batch_number || consumption.brand_name) {
                         let expiry_date: string | undefined;
                         if (consumption.batch_number) {
                              const stockDetails = await model.getAvailableStockDetails(consumption.item_id);
                              const batchInfo = stockDetails.available_batches.find(b => b.batch_number === consumption.batch_number);
                              if (batchInfo) {
                                   expiry_date = batchInfo.expiry_date;
                              }
                         }

                         const transactionData: CreateInventoryTransactionRequest = {
                              item_id: consumption.item_id,
                              transaction_type: consumption.transaction_type,
                              unit_type: 'consumption',
                              quantity: consumption.quantity,
                              wastage_type: consumption.wastage_type,
                              reason: consumption.reason || 'Manual consumption',
                              batch_number: consumption.batch_number,
                              brand_name: consumption.brand_name,
                              expiry_date: expiry_date,
                              performed_by: consumption.performed_by,
                              notes: consumption.notes
                         };

                         const consumptionHistoryId = await this.createConsumptionHistoryRecord(tenantId, {
                              item_id: consumption.item_id,
                              quantity_consumed: consumption.quantity,
                              consumed_by: consumption.performed_by?.toString(),
                              consumption_date: new Date(),
                              batch_number: consumption.batch_number,
                              brand_name: consumption.brand_name,
                              consumption_reason: consumption.reason || 'Manual consumption',
                              department: 'inventory',
                              notes: consumption.notes,
                              approved_by: consumption.performed_by?.toString()
                         });

                         transactionData.reference_id = consumptionHistoryId;

                         const transaction = await model.create(transactionData);

                         results.push({
                              ...transaction,
                              consumption_method: 'manual',
                              consumed_from_batch: transactionData.batch_number,
                              consumed_brand: transactionData.brand_name
                         });
                    } else {
                         const stockDetails = await model.getAvailableStockDetails(consumption.item_id);
                         if (stockDetails.available_batches.length === 0) {
                              const response: ApiResponse = {
                                   success: false,
                                   error: {
                                        code: 'NO_AVAILABLE_BATCHES',
                                        message: `No available batches found for FIFO consumption of item ${consumption.item_id}`
                                   }
                              };
                              res.status(400).json(response);
                              return;
                         }

                         const totalAvailableQuantity = stockDetails.available_batches.reduce((sum, batch) => sum + batch.available_quantity, 0);
                         if (totalAvailableQuantity < consumption.quantity) {
                              const response: ApiResponse = {
                                   success: false,
                                   error: {
                                        code: 'INSUFFICIENT_STOCK',
                                        message: `Insufficient total stock for FIFO consumption. Requested: ${consumption.quantity}, Total Available: ${totalAvailableQuantity}`
                                   }
                              };
                              res.status(400).json(response);
                              return;
                         }

                         let remainingQuantity = consumption.quantity;
                         const batchesToConsume: Array<{ batch_number: string; brand_name?: string; expiry_date?: string; quantity: number }> = [];

                         for (const batch of stockDetails.available_batches) {
                              if (remainingQuantity <= 0) break;

                              const consumeFromBatch = Math.min(remainingQuantity, batch.available_quantity);
                              batchesToConsume.push({
                                   batch_number: batch.batch_number,
                                   brand_name: batch.brand_name,
                                   expiry_date: batch.expiry_date,
                                   quantity: consumeFromBatch
                              });

                              remainingQuantity -= consumeFromBatch;
                              console.log(`Will consume ${consumeFromBatch} from batch ${batch.batch_number} (expiry: ${batch.expiry_date}), remaining: ${remainingQuantity}`);
                         }

                         console.log(`Final consumption plan:`, batchesToConsume);

                         const fifoTransactions: any[] = [];
                         for (const batchConsumption of batchesToConsume) {
                              console.log(`Creating FIFO transaction for batch ${batchConsumption.batch_number}, quantity: ${batchConsumption.quantity}`);

                              const batchTransactionData: CreateInventoryTransactionRequest = {
                                   item_id: consumption.item_id,
                                   transaction_type: consumption.transaction_type,
                                   unit_type: 'consumption',
                                   quantity: batchConsumption.quantity,
                                   wastage_type: consumption.wastage_type,
                                   reason: consumption.reason || 'FIFO consumption',
                                   batch_number: batchConsumption.batch_number,
                                   brand_name: batchConsumption.brand_name,
                                   expiry_date: batchConsumption.expiry_date,
                                   performed_by: consumption.performed_by,
                                   notes: consumption.notes || `FIFO consumption from batch ${batchConsumption.batch_number} (${batchConsumption.quantity} units)`
                              };

                              const batchConsumptionHistoryId = await this.createConsumptionHistoryRecord(tenantId, {
                                   item_id: consumption.item_id,
                                   quantity_consumed: batchConsumption.quantity,
                                   consumed_by: consumption.performed_by?.toString(),
                                   consumption_date: new Date(),
                                   batch_number: batchConsumption.batch_number,
                                   brand_name: batchConsumption.brand_name,
                                   consumption_reason: consumption.reason || 'FIFO consumption',
                                   department: 'inventory',
                                   notes: consumption.notes || `FIFO consumption from batch ${batchConsumption.batch_number}`,
                                   approved_by: consumption.performed_by?.toString()
                              });

                              batchTransactionData.reference_id = batchConsumptionHistoryId;

                              const transaction = await model.create(batchTransactionData);
                              console.log(`Created transaction ${transaction.id} for batch ${batchConsumption.batch_number}`);

                              fifoTransactions.push({
                                   ...transaction,
                                   consumed_quantity: batchConsumption.quantity
                              });
                         }

                         const primaryTransaction = fifoTransactions[0];
               

                         results.push({
                              ...primaryTransaction,
                              consumption_method: 'fifo',
                              consumed_from_batch: primaryTransaction.batch_number,
                              consumed_brand: primaryTransaction.brand_name,
                              total_consumed: consumption.quantity,
                              batch_breakdown: batchesToConsume
                         });
                    }
               }

               const response: ApiResponse = {
                    success: true,
                    data: results.length === 1 ? results[0] : results
               };
               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error in unified consumption:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to process consumption'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getExpiredConsumptionHistory(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const tenantId = this.getTenantId(req);
               const {
                    page = 1,
                    count = 10,
                    sortby = 'DESC',
                    item_id,
                    batch_number,
                    startDate,
                    endDate,
                    performed_by
               } = req.query;

               const connection = await (model as any).connection;

               const sortOrder = (sortby as string).toUpperCase() === 'ASC' ? 'asc' : 'desc';

               let query = connection('inv_consumption_history')
                    .leftJoin('inv_inventory_items', 'inv_consumption_history.item_id', 'inv_inventory_items.id')
                    .leftJoin('roles', 'inv_consumption_history.consumed_by', 'roles.employeeid')
                    .select(
                         'inv_consumption_history.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'roles.username',
                         'roles.email',
                         'roles.role as role_name',
                         'roles.employeeid as employee_id'
                    )
                    .where('inv_consumption_history.consumption_reason', 'like', '%wastage%')
                    .orderBy('inv_consumption_history.consumption_date', sortOrder);

               if (item_id) {
                    query = query.where('inv_consumption_history.item_id', item_id);
               }
               if (batch_number) {
                    query = query.where('inv_consumption_history.batch_number', batch_number);
               }
               if (performed_by) {
                    query = query.where('inv_consumption_history.consumed_by', performed_by);
               }
               if (startDate) {
                    query = query.where('inv_consumption_history.consumption_date', '>=', new Date(startDate as string));
               }
               if (endDate) {
                    query = query.where('inv_consumption_history.consumption_date', '<=', new Date(endDate as string + ' 23:59:59'));
               }

               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult?.count as string) || 0;

               const offset = (parseInt(page as string) - 1) * parseInt(count as string);
               const rawData = await query.limit(parseInt(count as string)).offset(offset);

               const expiredConsumptionHistory = rawData.filter((consumption: any) => {
                    const reason = (consumption.consumption_reason || '').toLowerCase();
                    return reason.includes('expired') || reason.includes('expiry');
               });

               const totalExpiredQuantity = expiredConsumptionHistory.reduce((sum, c) => sum + c.quantity_consumed, 0);
               const uniqueBatches = new Set(expiredConsumptionHistory.map(c => c.batch_number).filter(Boolean)).size;
               const uniqueItems = new Set(expiredConsumptionHistory.map(c => c.item_id)).size;

               const expiredConsumptionData = expiredConsumptionHistory.map(consumption => ({
                    id: consumption.id,
                    item_id: consumption.item_id,
                    item_name: consumption.item_name || '',
                    item_sku: consumption.item_sku || '',
                    batch_number: consumption.batch_number,
                    brand_name: consumption.brand_name,
                    expiry_date: null, // Not directly available in consumption_history
                    quantity_consumed: consumption.quantity_consumed,
                    wastage_type: 'expired', // Assuming expired based on filter
                    reason: consumption.consumption_reason,
                    performed_by: {
                         employee_id: consumption.employee_id,
                         username: consumption.username,
                         email: consumption.email,
                         role_name: consumption.role_name,
                         full_name: consumption.username || 'Unknown User'
                    },
                    transaction_date: consumption.consumption_date,
                    notes: consumption.notes,
                    department: consumption.department,
                    unit_cost: consumption.unit_cost,
                    total_cost: consumption.total_cost,
                    approved_by: consumption.approved_by
               }));

               const response: ApiResponse = {
                    success: true,
                    data: {
                         expired_consumptions: expiredConsumptionData,
                         total: expiredConsumptionHistory.length,
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         totalPages: Math.ceil(expiredConsumptionHistory.length / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC',
                         summary: {
                              total_expired_consumptions: expiredConsumptionHistory.length,
                              total_quantity_expired: totalExpiredQuantity,
                              unique_batches_affected: uniqueBatches,
                              unique_items_affected: uniqueItems,
                              period_start: startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              period_end: endDate as string || new Date().toISOString().split('T')[0]
                         }
                    },
                    pagination: {
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         total: expiredConsumptionHistory.length,
                         totalPages: Math.ceil(expiredConsumptionHistory.length / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC'
                    }
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting expired consumption history:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get expired consumption history'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getNonExpiredWastageHistory(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const tenantId = this.getTenantId(req);
               const {
                    page = 1,
                    count = 10,
                    sortby = 'DESC',
                    item_id,
                    batch_number,
                    startDate,
                    endDate,
                    performed_by
               } = req.query;

               const connection = await (model as any).connection;

               const sortOrder = (sortby as string).toUpperCase() === 'ASC' ? 'asc' : 'desc';

               let query = connection('inv_consumption_history')
                    .leftJoin('inv_inventory_items', 'inv_consumption_history.item_id', 'inv_inventory_items.id')
                    .leftJoin('roles', 'inv_consumption_history.consumed_by', 'roles.employeeid')
                    .select(
                         'inv_consumption_history.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'roles.username',
                         'roles.email',
                         'roles.role as role_name',
                         'roles.employeeid as employee_id'
                    )
                    .where('inv_consumption_history.consumption_reason', 'like', '%wastage%')
                    .orderBy('inv_consumption_history.consumption_date', sortOrder);

               if (item_id) {
                    query = query.where('inv_consumption_history.item_id', item_id);
               }
               if (batch_number) {
                    query = query.where('inv_consumption_history.batch_number', batch_number);
               }
               if (performed_by) {
                    query = query.where('inv_consumption_history.consumed_by', performed_by);
               }
               if (startDate) {
                    query = query.where('inv_consumption_history.consumption_date', '>=', new Date(startDate as string));
               }
               if (endDate) {
                    query = query.where('inv_consumption_history.consumption_date', '<=', new Date(endDate as string + ' 23:59:59'));
               }

               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult?.count as string) || 0;

               const offset = (parseInt(page as string) - 1) * parseInt(count as string);
               const rawData = await query.limit(parseInt(count as string)).offset(offset);

               const nonExpiredWastageHistory = rawData.filter((consumption: any) => {
                    const reason = (consumption.consumption_reason || '').toLowerCase();
                    return !(reason.includes('expired') || reason.includes('expiry'));
               });

               const totalNonExpiredQuantity = nonExpiredWastageHistory.reduce((sum, c) => sum + c.quantity_consumed, 0);
               const uniqueBatches = new Set(nonExpiredWastageHistory.map(c => c.batch_number).filter(Boolean)).size;
               const uniqueItems = new Set(nonExpiredWastageHistory.map(c => c.item_id)).size;

               const nonExpiredWastageData = nonExpiredWastageHistory.map(consumption => ({
                    id: consumption.id,
                    item_id: consumption.item_id,
                    item_name: consumption.item_name || '',
                    item_sku: consumption.item_sku || '',
                    batch_number: consumption.batch_number,
                    brand_name: consumption.brand_name,
                    expiry_date: null, // Not directly available in consumption_history
                    quantity_wasted: consumption.quantity_consumed,
                    wastage_type: 'other', // Non-expired wastage
                    reason: consumption.consumption_reason,
                    performed_by: {
                         employee_id: consumption.employee_id,
                         username: consumption.username,
                         email: consumption.email,
                         role_name: consumption.role_name,
                         full_name: consumption.username || 'Unknown User'
                    },
                    transaction_date: consumption.consumption_date,
                    notes: consumption.notes,
                    department: consumption.department,
                    unit_cost: consumption.unit_cost,
                    total_cost: consumption.total_cost,
                    approved_by: consumption.approved_by
               }));

               const response: ApiResponse = {
                    success: true,
                    data: {
                         non_expired_wastages: nonExpiredWastageData,
                         total: nonExpiredWastageHistory.length,
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         totalPages: Math.ceil(nonExpiredWastageHistory.length / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC',
                         summary: {
                              total_non_expired_wastages: nonExpiredWastageHistory.length,
                              total_quantity_wasted: totalNonExpiredQuantity,
                              unique_batches_affected: uniqueBatches,
                              unique_items_affected: uniqueItems,
                              period_start: startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              period_end: endDate as string || new Date().toISOString().split('T')[0]
                         }
                    },
                    pagination: {
                         page: parseInt(page as string),
                         count: parseInt(count as string),
                         total: nonExpiredWastageHistory.length,
                         totalPages: Math.ceil(nonExpiredWastageHistory.length / parseInt(count as string)),
                         sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC'
                    }
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting non-expired wastage history:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get non-expired wastage history'
                    }
               };
               res.status(500).json(response);
          }
     }


     async getAscensionDirectConsumption(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    sortby = 'DESC',
                    dateFrom,
                    dateEnd,
                    operationsStaging,
                    searchString = '',
                    page = 1,
                    count = 10,
                    isUltrasound = false,
                    clinicianId,
                    organizationId
               } = req.query;

               const queryParams = {
                    sortby: (sortby as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
                    _dateFrom: dateFrom,
                    _dateEnd: dateEnd,
                    stage: operationsStaging || "COMPLETED",
                    searchString: searchString as string,
                    page: parseInt(page as string),
                    count: parseInt(count as string),
                    isUltrasound: isUltrasound === 'true',
                    clinicianId: clinicianId ? parseInt(clinicianId as string) : undefined,
                    organizationId: organizationId ? parseInt(organizationId as string) : undefined
               };

               const model = new InventoryTemplateModel(tenantId);
               const list = await model.getAscensionDirectConsumption(tenantId, queryParams as any);
               const response: ApiResponse = {
                    success: true,
                    data: list
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting ascension direct consumption:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get ascension direct consumption'
                    }
               };
               res.status(500).json(response);
          }
     }

}