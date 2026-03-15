"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispenseOrder = void 0;
const helper_1 = require("../../hooks/helper");
const PharmacyDispensationService_1 = require("../../models/pharmacy/PharmacyDispensationService");
const dispensationService = new PharmacyDispensationService_1.PharmacyDispensationService();
const dispenseOrder = async (req, res) => {
    var _a;
    try {
        const orderId = parseInt(req.params.id);
        const pharmacistId = parseInt(req.body.pharmacist_id);
        if (!orderId || !pharmacistId) {
            res.status(400).json({ error: 'Order ID and Pharmacist ID are required' });
            return;
        }
        const tenantId = parseInt(((_a = req.query.tenantId) === null || _a === void 0 ? void 0 : _a.toString()) || '0', 10);
        if (!tenantId) {
            res.status(400).json({ error: 'Tenant ID is missing' });
            return;
        }
        const result = await dispensationService.dispenseOrder(tenantId, orderId, pharmacistId);
        if (result.success) {
            res.send({ status: true, message: result.message });
            return;
        }
        else {
            res.status(400).send({ status: false, message: result.message });
            return;
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.dispenseOrder = dispenseOrder;
