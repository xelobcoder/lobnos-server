"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_1 = require("../../../models/inventory");
const helper_1 = require("../../../hooks/helper");
const router = (0, express_1.Router)();
const create = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Tenant ID is required' }
            });
        }
        const model = new inventory_1.InventoryTransactionModel(tenantId);
        const transaction = await model.create(req.body);
        const response = {
            success: true,
            data: transaction
        };
        res.status(201).json(response);
    }
    catch (error) {
        console.error('Transaction creation error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message || 'Transaction creation failed' }
        });
    }
};
router.post('/create', (0, helper_1.handleOverLoad)(create));
exports.default = router;
