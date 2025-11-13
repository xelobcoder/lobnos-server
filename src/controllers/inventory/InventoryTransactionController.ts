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

export class InventoryTransactionController {
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

     private validateConsumptionRequest(data: any): { isValid: boolean; errors: string[] } {
          const errors: string[] = [];

          if (!data.item_id || typeof data.item_id !== 'string') {
               errors.push('Item ID is required and must be a string');
          }

          if (!data.quantity || typeof data.quantity !== 'number' || data.quantity <= 0) {
               errors.push('Quantity must be a positive number');
          }

          // if (data.quantity && data.quantity > 10000) {
          //      errors.push('Quantity cannot exceed 10,000 units per transaction');
          // }

          return { isValid: errors.length === 0, errors };
     }

     async recordTestConsumption(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { test_id, item_id, quantity_used, test_type, patient_id, ascension_id, testid, batch_number, brand_name, performed_by, notes } = req.body;
               const tenantId = this.getTenantId(req);

               if (!test_id || !item_id || !quantity_used || !test_type || !patient_id || !ascension_id || !performed_by) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Missing required fields: test_id, item_id, quantity_used, test_type, patient_id, ascension_id, performed_by'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const validation = this.validateConsumptionRequest({ item_id, quantity: quantity_used });
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

               const stockCheck = await this.validateStockAvailability(tenantId, item_id, quantity_used);
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

               let expiry_date: string | undefined;
               if (batch_number) {
                    const stockDetails = await model.getAvailableStockDetails(item_id);
                    const batchInfo = stockDetails.available_batches.find(b => b.batch_number === batch_number);
                    if (batchInfo) {
                         expiry_date = batchInfo.expiry_date;
                    }
               }

               const transactionData: CreateInventoryTransactionRequest = {
                    item_id,
                    transaction_type: 'consumption',
                    quantity: quantity_used,
                    reason: `Test consumption - ${test_type}`,
                    reference_id: test_id,
                    patient_id,
                    ascension_id,
                    testid,
                    batch_number,
                    brand_name,
                    expiry_date,
                    performed_by,
                    notes: notes || `Automatic consumption for test ${test_id}`
               };

               const transaction = await model.create(transactionData);

               const response: ApiResponse = {
                    success: true,
                    data: {
                         ...transaction,
                         stock_remaining: stockCheck.currentStock - quantity_used
                    }
               };
               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error recording test consumption:', error);
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

               // Check for duplicate wastage consumption
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

               const transactionData: CreateInventoryTransactionRequest = {
                    item_id,
                    transaction_type: 'wastage',
                    quantity,
                    reason: `Wastage - ${reason}`,
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
               const filters: InventoryTransactionFilters = {
                    ...req.query,
                    transaction_type: 'consumption'
               };

               const result = await model.findMany(filters);

               const response: ApiResponse = {
                    success: true,
                    data: result,
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

               const filters: InventoryTransactionFilters = {
                    page: parseInt(page as string),
                    count: parseInt(count as string),
                    sortby: (sortby as string).toUpperCase() as 'ASC' | 'DESC',
                    transaction_type: 'consumption',
                    item_id: item_id as string,
                    performed_by: performed_by ? parseInt(performed_by as string) : undefined,
                    startDate: startDate as string,
                    endDate: endDate as string
               };

               const result = await model.findMany(filters);

               const allConsumptionTransactions = await model.findMany({
                    ...filters,
                    page: 1,
                    count: 10000
               });

               const summary: ConsumptionSummary = {
                    total_consumptions: allConsumptionTransactions.total,
                    manual_consumptions: allConsumptionTransactions.transactions.filter(t => t.transaction_type === 'consumption' && !(t.reason || '').toLowerCase().includes('test') && !(t.reason || '').toLowerCase().includes('wastage')).length,
                    test_consumptions: allConsumptionTransactions.transactions.filter(t => (t.reason || '').toLowerCase().includes('test')).length,
                    wastage_consumptions: allConsumptionTransactions.transactions.filter(t => t.transaction_type === 'wastage').length,
                    total_quantity_consumed: allConsumptionTransactions.transactions.reduce((sum, t) => sum + t.quantity, 0),
                    period_start: startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    period_end: endDate as string || new Date().toISOString().split('T')[0]
               };

               const consumptions = result.transactions.map(transaction => ({
                    id: transaction.id,
                    item_id: transaction.item_id,
                    item_name: transaction.item_name || '',
                    item_sku: transaction.item_sku || '',
                    consumption_type: this.determineConsumptionType(transaction),
                    quantity: transaction.quantity,
                    reason: transaction.reason,
                    batch_number: transaction.batch_number,
                    patient_id: transaction.patient_id,
                    ascension_id: transaction.ascension_id,
                    testid: transaction.testid,
                    performed_by: transaction.performed_by,
                    transaction_date: transaction.transaction_date,
                    notes: transaction.notes
               }));

               const consumptionReport: ConsumptionReportResponse = {
                    consumptions,
                    total: result.total,
                    page: result.page,
                    count: result.count,
                    totalPages: result.totalPages,
                    sortby: result.sortby,
                    summary
               };

               const response: ApiResponse = {
                    success: true,
                    data: consumptionReport,
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

     private determineConsumptionType(transaction: any): 'manual' | 'test' | 'wastage' {
          if (transaction.transaction_type === 'wastage') return 'wastage';
          if ((transaction.reason || '').toLowerCase().includes('test')) return 'test';
          return 'manual';
     }

     private async validateNoDuplicateWastage(tenantId: number, itemId: string, batchNumber?: string, wastageType?: string, reason?: string): Promise<{ isValid: boolean; message?: string }> {
          const model = new InventoryTransactionModel(tenantId);

          try {
               // Check if this batch/item combination has already been consumed as wastage with the same reason/type
               const filters: any = {
                    transaction_type: 'wastage',
                    count: 1
               };

               if (batchNumber) {
                    filters.batch_number = batchNumber;
               }

               const existingWastage = await model.findByItemId(itemId, filters);

               // Filter transactions that match the same wastage reason/type
               const matchingWastage = existingWastage.transactions.filter((transaction: any) => {
                    const existingReason = (transaction.reason || '').toLowerCase();
                    const existingWastageType = (transaction.wastage_type || '').toLowerCase();
                    const currentReason = (reason || '').toLowerCase();
                    const currentWastageType = (wastageType || '').toLowerCase();

                    // Check if it's the same type of wastage
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
               // If we can't check, allow the transaction to proceed (fail-safe)
               return { isValid: true };
          }
     }

     async getAvailableStockDetails(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { item_id } = req.params;
               const tenantId = this.getTenantId(req);

               if (!item_id) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const stockDetails = await model.getAvailableStockDetails(item_id);

               const response: ApiResponse = {
                    success: true,
                    data: stockDetails
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting available stock details:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get available stock details'
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

                    // Check for duplicate wastage consumption
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
                              quantity: consumption.quantity,
                              wastage_type: consumption.wastage_type,
                              reason: consumption.reason || 'Manual consumption',
                              batch_number: consumption.batch_number,
                              brand_name: consumption.brand_name,
                              expiry_date: expiry_date,
                              performed_by: consumption.performed_by,
                              notes: consumption.notes
                         };

                         const transaction = await model.create(transactionData);
                         console.log(`Manual consumption processed for item ${consumption.item_id}:`, {
                              quantity: consumption.quantity,
                              batch_number: transactionData.batch_number,
                              previous_stock: transaction.previous_stock,
                              new_stock: transaction.new_stock
                         });
                         results.push({
                              ...transaction,
                              consumption_method: 'manual',
                              consumed_from_batch: transactionData.batch_number,
                              consumed_brand: transactionData.brand_name
                         });
                    } else {
                         console.log(`Starting FIFO consumption for item ${consumption.item_id}, quantity: ${consumption.quantity}`);

                         const stockDetails = await model.getAvailableStockDetails(consumption.item_id);
                         console.log(`Stock details for FIFO:`, {
                              total_available: stockDetails.available_batches.reduce((sum, b) => sum + b.available_quantity, 0),
                              batches: stockDetails.available_batches.map(b => `${b.batch_number}: ${b.available_quantity}`)
                         });

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
                         console.log(`Total available quantity: ${totalAvailableQuantity}, requested: ${consumption.quantity}`);

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
                                   quantity: batchConsumption.quantity,
                                   wastage_type: consumption.wastage_type,
                                   reason: consumption.reason || 'FIFO consumption',
                                   batch_number: batchConsumption.batch_number,
                                   brand_name: batchConsumption.brand_name,
                                   expiry_date: batchConsumption.expiry_date,
                                   performed_by: consumption.performed_by,
                                   notes: consumption.notes || `FIFO consumption from batch ${batchConsumption.batch_number} (${batchConsumption.quantity} units)`
                              };

                              const transaction = await model.create(batchTransactionData);
                              console.log(`Created transaction ${transaction.id} for batch ${batchConsumption.batch_number}`);

                              fifoTransactions.push({
                                   ...transaction,
                                   consumed_quantity: batchConsumption.quantity
                              });
                         }

                         const primaryTransaction = fifoTransactions[0];
                         console.log(`FIFO consumption completed for item ${consumption.item_id}:`, {
                              total_quantity: consumption.quantity,
                              batches_consumed: batchesToConsume.map(b => `${b.batch_number}: ${b.quantity} units`),
                              transactions_created: fifoTransactions.length
                         });

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

     async getExpiredBatches(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);

               const expiredBatches = await model.getExpiredBatches();

               const response: ApiResponse = {
                    success: true,
                    data: expiredBatches
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting expired batches:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get expired batches'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getExpiredBatchesForItem(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { item_id } = req.params;

               if (!item_id) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const expiredBatches = await model.getExpiredBatches();
               const itemExpiredBatches = expiredBatches.filter(batch => batch.item_id === item_id);

               const response: ApiResponse = {
                    success: true,
                    data: itemExpiredBatches
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting expired batches for item:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get expired batches for item'
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

               // Custom query to include employee details
               const connection = await (model as any).connection;

               const sortOrder = (sortby as string).toUpperCase() === 'ASC' ? 'asc' : 'desc';

               let query = connection('inv_inventory_transactions')
                    .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                    .leftJoin('roles', 'inv_inventory_transactions.performed_by', 'roles.employeeid')
                    .select(
                         'inv_inventory_transactions.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'roles.username',
                         'roles.email',
                         'roles.role as role_name',
                         'roles.employeeid as employee_id'
                    )
                    .where('inv_inventory_transactions.transaction_type', 'wastage')
                    .orderBy('inv_inventory_transactions.transaction_date', sortOrder);

               // Apply filters
               if (item_id) {
                    query = query.where('inv_inventory_transactions.item_id', item_id);
               }
               if (batch_number) {
                    query = query.where('inv_inventory_transactions.batch_number', batch_number);
               }
               if (performed_by) {
                    query = query.where('inv_inventory_transactions.performed_by', parseInt(performed_by as string));
               }
               if (startDate) {
                    query = query.where('inv_inventory_transactions.transaction_date', '>=', startDate);
               }
               if (endDate) {
                    query = query.where('inv_inventory_transactions.transaction_date', '<=', endDate);
               }

               // Get total count
               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult?.count as string) || 0;

               // Apply pagination
               const offset = (parseInt(page as string) - 1) * parseInt(count as string);
               const rawData = await query.limit(parseInt(count as string)).offset(offset);

               // Filter transactions that are expired wastage
               const expiredConsumptionHistory = rawData.filter((transaction: any) => {
                    const reason = (transaction.reason || '').toLowerCase();
                    const wastageType = (transaction.wastage_type || '').toLowerCase();
                    return wastageType === 'expired' ||
                         reason.includes('expired') ||
                         reason.includes('expiry');
               });

               // Calculate summary
               const totalExpiredQuantity = expiredConsumptionHistory.reduce((sum, t) => sum + t.quantity, 0);
               const uniqueBatches = new Set(expiredConsumptionHistory.map(t => t.batch_number).filter(Boolean)).size;
               const uniqueItems = new Set(expiredConsumptionHistory.map(t => t.item_id)).size;

               const expiredConsumptionData = expiredConsumptionHistory.map(transaction => ({
                    id: transaction.id,
                    item_id: transaction.item_id,
                    item_name: transaction.item_name || '',
                    item_sku: transaction.item_sku || '',
                    batch_number: transaction.batch_number,
                    brand_name: transaction.brand_name,
                    expiry_date: transaction.expiry_date,
                    quantity_consumed: transaction.quantity,
                    wastage_type: transaction.wastage_type,
                    reason: transaction.reason,
                    performed_by: {
                         employee_id: transaction.employee_id,
                         username: transaction.username,
                         email: transaction.email,
                         role_name: transaction.role_name,
                         full_name: transaction.username || 'Unknown User'
                    },
                    transaction_date: transaction.transaction_date,
                    notes: transaction.notes
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

               let query = connection('inv_inventory_transactions')
                    .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                    .leftJoin('roles', 'inv_inventory_transactions.performed_by', 'roles.employeeid')
                    .select(
                         'inv_inventory_transactions.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'roles.username',
                         'roles.email',
                         'roles.role as role_name',
                         'roles.employeeid as employee_id'
                    )
                    .where('inv_inventory_transactions.transaction_type', 'wastage')
                    .orderBy('inv_inventory_transactions.transaction_date', sortOrder);

               if (item_id) {
                    query = query.where('inv_inventory_transactions.item_id', item_id);
               }
               if (batch_number) {
                    query = query.where('inv_inventory_transactions.batch_number', batch_number);
               }
               if (performed_by) {
                    query = query.where('inv_inventory_transactions.performed_by', parseInt(performed_by as string));
               }
               if (startDate) {
                    query = query.where('inv_inventory_transactions.transaction_date', '>=', startDate);
               }
               if (endDate) {
                    query = query.where('inv_inventory_transactions.transaction_date', '<=', endDate);
               }

               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult?.count as string) || 0;

               const offset = (parseInt(page as string) - 1) * parseInt(count as string);
               const rawData = await query.limit(parseInt(count as string)).offset(offset);

               const nonExpiredWastageHistory = rawData.filter((transaction: any) => {
                    const reason = (transaction.reason || '').toLowerCase();
                    const wastageType = (transaction.wastage_type || '').toLowerCase();
                    return !(wastageType === 'expired' ||
                         reason.includes('expired') ||
                         reason.includes('expiry'));
               });

               const totalNonExpiredQuantity = nonExpiredWastageHistory.reduce((sum, t) => sum + t.quantity, 0);
               const uniqueBatches = new Set(nonExpiredWastageHistory.map(t => t.batch_number).filter(Boolean)).size;
               const uniqueItems = new Set(nonExpiredWastageHistory.map(t => t.item_id)).size;

               const nonExpiredWastageData = nonExpiredWastageHistory.map(transaction => ({
                    id: transaction.id,
                    item_id: transaction.item_id,
                    item_name: transaction.item_name || '',
                    item_sku: transaction.item_sku || '',
                    batch_number: transaction.batch_number,
                    brand_name: transaction.brand_name,
                    expiry_date: transaction.expiry_date,
                    quantity_wasted: transaction.quantity,
                    wastage_type: transaction.wastage_type,
                    reason: transaction.reason,
                    performed_by: {
                         employee_id: transaction.employee_id,
                         username: transaction.username,
                         email: transaction.email,
                         role_name: transaction.role_name,
                         full_name: transaction.username || 'Unknown User'
                    },
                    transaction_date: transaction.transaction_date,
                    notes: transaction.notes
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
}