"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceCalculationController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class PriceCalculationController {
    static async calculatePrice(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { entityType, trackId, testPanelId, basePrice, currentDate, promoCode } = req.body;
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            if (!entityType || !trackId || !testPanelId || basePrice === undefined) {
                throw new Error('Missing required fields');
            }
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const finalPrice = await repo.getCalculatedPrice(entityType, parseInt(trackId), parseInt(testPanelId), parseFloat(basePrice), currentDate ? new Date(currentDate) : undefined, promoCode);
            res.json({ finalPrice });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.PriceCalculationController = PriceCalculationController;
