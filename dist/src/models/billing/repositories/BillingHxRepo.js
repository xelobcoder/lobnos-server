"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingHxRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class BillingHxRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(historyData) {
        try {
            return this.connection('billinghx')
                .insert(historyData);
        }
        catch (error) {
            console.error('Billing history creation error:', error);
            throw error;
        }
    }
    async update(KeyID, updates) {
        try {
            return this.connection('billinghx')
                .where({ KeyID })
                .update(updates);
        }
        catch (error) {
            console.error('Billing history update error:', error);
            throw error;
        }
    }
    async findByBillingId(billingId) {
        try {
            return this.connection('billinghx')
                .where({ Billingid: billingId });
        }
        catch (error) {
            console.error('Billing history find error:', error);
            throw error;
        }
    }
    async createBillingWithHistory(billingData, historyData) {
        const trx = await this.connection.transaction();
        try {
            const [billingId] = await trx('billing')
                .insert(billingData);
            const historyWithBillingId = Object.assign(Object.assign({}, historyData), { Billingid: billingId });
            await trx('billinghx').insert(historyWithBillingId);
            await trx.commit();
            return billingId;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
}
exports.BillingHxRepo = BillingHxRepo;
