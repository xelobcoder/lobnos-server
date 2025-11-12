"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryTransactionController = void 0;
const InventoryTransaction_1 = require("../../models/inventory/InventoryTransaction");
const InventoryItem_1 = require("../../models/inventory/InventoryItem");
class InventoryTransactionController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    getModel(req) {
        const tenantId = this.getTenantId(req);
        return new InventoryTransaction_1.InventoryTransactionModel(tenantId);
    }
    async validateBatchStockAvailability(tenantId, itemId, batchNumber, requestedQuantity) {
        try {
            const model = new InventoryTransaction_1.InventoryTransactionModel(tenantId);
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
        }
        catch (error) {
            console.error('Error validating batch stock:', error);
            return {
                isValid: false,
                availableQuantity: 0,
                message: 'Error checking batch stock availability'
            };
        }
    }
    async validateStockAvailability(tenantId, itemId, requestedQuantity) {
        try {
            const itemModel = new InventoryItem_1.InventoryItemModel(tenantId);
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
        }
        catch (error) {
            console.error('Error validating stock availability:', error);
            return {
                isValid: false,
                currentStock: 0,
                message: 'Error checking stock availability'
            };
        }
    }
    validateConsumptionRequest(data) {
        const errors = [];
        if (!data.item_id || typeof data.item_id !== 'string') {
            errors.push('Item ID is required and must be a string');
        }
        if (!data.quantity || typeof data.quantity !== 'number' || data.quantity <= 0) {
            errors.push('Quantity must be a positive number');
        }
        if (data.quantity && data.quantity > 10000) {
            errors.push('Quantity cannot exceed 10,000 units per transaction');
        }
        return { isValid: errors.length === 0, errors };
    }
    async recordTestConsumption(req, res) {
        try {
            const model = this.getModel(req);
            const { test_id, item_id, quantity_used, test_type, patient_id, ascension_id, testid, batch_number, brand_name, performed_by, notes } = req.body;
            const tenantId = this.getTenantId(req);
            if (!test_id || !item_id || !quantity_used || !test_type || !patient_id || !ascension_id || !performed_by) {
                const response = {
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
                const response = {
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
                const response = {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_STOCK',
                        message: stockCheck.message || 'Insufficient stock available'
                    }
                };
                res.status(400).json(response);
                return;
            }
            let expiry_date;
            if (batch_number) {
                const stockDetails = await model.getAvailableStockDetails(item_id);
                const batchInfo = stockDetails.available_batches.find(b => b.batch_number === batch_number);
                if (batchInfo) {
                    expiry_date = batchInfo.expiry_date;
                }
            }
            const transactionData = {
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
            const response = {
                success: true,
                data: Object.assign(Object.assign({}, transaction), { stock_remaining: stockCheck.currentStock - quantity_used })
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error recording test consumption:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to record test consumption'
                }
            };
            res.status(500).json(response);
        }
    }
    async recordWastage(req, res) {
        try {
            const model = this.getModel(req);
            const { item_id, quantity, reason, batch_number, brand_name, performed_by, notes } = req.body;
            const tenantId = this.getTenantId(req);
            if (!item_id || !quantity || !reason) {
                const response = {
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
                const response = {
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
                const response = {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_STOCK',
                        message: stockCheck.message || 'Insufficient stock available'
                    }
                };
                res.status(400).json(response);
                return;
            }
            let expiry_date;
            if (batch_number) {
                const stockDetails = await model.getAvailableStockDetails(item_id);
                const batchInfo = stockDetails.available_batches.find(b => b.batch_number === batch_number);
                if (batchInfo) {
                    expiry_date = batchInfo.expiry_date;
                }
            }
            const transactionData = {
                item_id,
                transaction_type: 'consumption',
                quantity,
                reason: `Wastage - ${reason}`,
                batch_number,
                brand_name,
                expiry_date,
                performed_by,
                notes
            };
            const transaction = await model.create(transactionData);
            const response = {
                success: true,
                data: Object.assign(Object.assign({}, transaction), { stock_remaining: stockCheck.currentStock - quantity })
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error recording wastage:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to record wastage'
                }
            };
            res.status(500).json(response);
        }
    }
    async getConsumptionTransactions(req, res) {
        try {
            const model = this.getModel(req);
            const filters = Object.assign(Object.assign({}, req.query), { transaction_type: 'consumption' });
            const result = await model.findMany(filters);
            const response = {
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
        }
        catch (error) {
            console.error('Error getting consumption transactions:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get consumption transactions'
                }
            };
            res.status(500).json(response);
        }
    }
    async getConsumptionReport(req, res) {
        try {
            const model = this.getModel(req);
            const { page = 1, count = 10, sortby = 'DESC', consumption_type, item_id, performed_by, startDate, endDate, reason } = req.query;
            const filters = {
                page: parseInt(page),
                count: parseInt(count),
                sortby: sortby.toUpperCase(),
                transaction_type: 'consumption',
                item_id: item_id,
                performed_by: performed_by ? parseInt(performed_by) : undefined,
                startDate: startDate,
                endDate: endDate
            };
            const result = await model.findMany(filters);
            const allConsumptionTransactions = await model.findMany(Object.assign(Object.assign({}, filters), { page: 1, count: 10000 }));
            const summary = {
                total_consumptions: allConsumptionTransactions.total,
                manual_consumptions: allConsumptionTransactions.transactions.filter(t => (t.reason || '').toLowerCase().includes('manual')).length,
                test_consumptions: allConsumptionTransactions.transactions.filter(t => (t.reason || '').toLowerCase().includes('test')).length,
                wastage_consumptions: allConsumptionTransactions.transactions.filter(t => (t.reason || '').toLowerCase().includes('wastage')).length,
                total_quantity_consumed: allConsumptionTransactions.transactions.reduce((sum, t) => sum + t.quantity, 0),
                period_start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                period_end: endDate || new Date().toISOString().split('T')[0]
            };
            const consumptions = result.transactions.map(transaction => ({
                id: transaction.id,
                item_id: transaction.item_id,
                item_name: transaction.item_name || '',
                item_sku: transaction.item_sku || '',
                consumption_type: this.determineConsumptionType(transaction.reason || ''),
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
            const consumptionReport = {
                consumptions,
                total: result.total,
                page: result.page,
                count: result.count,
                totalPages: result.totalPages,
                sortby: result.sortby,
                summary
            };
            const response = {
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
        }
        catch (error) {
            console.error('Error getting consumption report:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get consumption report'
                }
            };
            res.status(500).json(response);
        }
    }
    determineConsumptionType(reason) {
        if (reason.toLowerCase().includes('test'))
            return 'test';
        if (reason.toLowerCase().includes('wastage'))
            return 'wastage';
        return 'manual';
    }
    async getAvailableStockDetails(req, res) {
        try {
            const model = this.getModel(req);
            const { item_id } = req.params;
            const tenantId = this.getTenantId(req);
            if (!item_id) {
                const response = {
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
            const response = {
                success: true,
                data: stockDetails
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error getting available stock details:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get available stock details'
                }
            };
            res.status(500).json(response);
        }
    }
    async consumeStockUnified(req, res) {
        try {
            const model = this.getModel(req);
            const { consumptions, item_id, quantity, reason, batch_number, brand_name, performed_by, notes } = req.body;
            const tenantId = this.getTenantId(req);
            let consumptionRequests = [];
            if (item_id && quantity !== undefined) {
                consumptionRequests = [{
                        item_id,
                        quantity,
                        reason,
                        batch_number,
                        brand_name,
                        performed_by,
                        notes
                    }];
            }
            else if (consumptions && Array.isArray(consumptions)) {
                consumptionRequests = consumptions;
            }
            else {
                const response = {
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
                    const response = {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: `Validation failed for item ${consumption.item_id}: ${validation.errors.join(', ')}`
                        }
                    };
                    res.status(400).json(response);
                    return;
                }
                const stockCheck = await this.validateStockAvailability(tenantId, consumption.item_id, consumption.quantity);
                if (!stockCheck.isValid) {
                    const response = {
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
                        const response = {
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
                    let expiry_date;
                    if (consumption.batch_number) {
                        const stockDetails = await model.getAvailableStockDetails(consumption.item_id);
                        const batchInfo = stockDetails.available_batches.find(b => b.batch_number === consumption.batch_number);
                        if (batchInfo) {
                            expiry_date = batchInfo.expiry_date;
                        }
                    }
                    const transactionData = {
                        item_id: consumption.item_id,
                        transaction_type: 'consumption',
                        quantity: consumption.quantity,
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
                    results.push(Object.assign(Object.assign({}, transaction), { consumption_method: 'manual', consumed_from_batch: transactionData.batch_number, consumed_brand: transactionData.brand_name }));
                }
                else {
                    console.log(`Starting FIFO consumption for item ${consumption.item_id}, quantity: ${consumption.quantity}`);
                    const stockDetails = await model.getAvailableStockDetails(consumption.item_id);
                    console.log(`Stock details for FIFO:`, {
                        total_available: stockDetails.available_batches.reduce((sum, b) => sum + b.available_quantity, 0),
                        batches: stockDetails.available_batches.map(b => `${b.batch_number}: ${b.available_quantity}`)
                    });
                    if (stockDetails.available_batches.length === 0) {
                        const response = {
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
                        const response = {
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
                    const batchesToConsume = [];
                    for (const batch of stockDetails.available_batches) {
                        if (remainingQuantity <= 0)
                            break;
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
                    const fifoTransactions = [];
                    for (const batchConsumption of batchesToConsume) {
                        console.log(`Creating FIFO transaction for batch ${batchConsumption.batch_number}, quantity: ${batchConsumption.quantity}`);
                        const batchTransactionData = {
                            item_id: consumption.item_id,
                            transaction_type: 'consumption',
                            quantity: batchConsumption.quantity,
                            reason: consumption.reason || 'FIFO consumption',
                            batch_number: batchConsumption.batch_number,
                            brand_name: batchConsumption.brand_name,
                            expiry_date: batchConsumption.expiry_date,
                            performed_by: consumption.performed_by,
                            notes: consumption.notes || `FIFO consumption from batch ${batchConsumption.batch_number} (${batchConsumption.quantity} units)`
                        };
                        const transaction = await model.create(batchTransactionData);
                        console.log(`Created transaction ${transaction.id} for batch ${batchConsumption.batch_number}`);
                        fifoTransactions.push(Object.assign(Object.assign({}, transaction), { consumed_quantity: batchConsumption.quantity }));
                    }
                    const primaryTransaction = fifoTransactions[0];
                    console.log(`FIFO consumption completed for item ${consumption.item_id}:`, {
                        total_quantity: consumption.quantity,
                        batches_consumed: batchesToConsume.map(b => `${b.batch_number}: ${b.quantity} units`),
                        transactions_created: fifoTransactions.length
                    });
                    results.push(Object.assign(Object.assign({}, primaryTransaction), { consumption_method: 'fifo', consumed_from_batch: primaryTransaction.batch_number, consumed_brand: primaryTransaction.brand_name, total_consumed: consumption.quantity, batch_breakdown: batchesToConsume }));
                }
            }
            const response = {
                success: true,
                data: results.length === 1 ? results[0] : results
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error in unified consumption:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to process consumption'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryTransactionController = InventoryTransactionController;
