"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class AuditController {
    static async getAuditLogs(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            const audits = await conn('prime_billing_audit').select('*').orderBy('calculated_at', 'desc');
            res.json(audits);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.AuditController = AuditController;
