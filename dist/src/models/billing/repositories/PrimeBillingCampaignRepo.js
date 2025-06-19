"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeBillingCampaignRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class PrimeBillingCampaignRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        try {
            const conn = await this.connection;
            const [id] = await conn('prime_billing_campaigns').insert(data);
            return id;
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('Duplicate entry'))) {
                return 'Campaign name must be unique.Duplicate entry found';
            }
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_campaigns').where({ id }).first();
        }
        catch (error) {
            console.error('PrimeBillingCampaign findById error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_campaigns').where({ id }).update(updates);
        }
        catch (error) {
            console.error('PrimeBillingCampaign update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_campaigns').where({ id }).delete();
        }
        catch (error) {
            console.error('PrimeBillingCampaign delete error:', error);
            throw error;
        }
    }
    async list() {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_campaigns').select();
        }
        catch (error) {
            console.error('PrimeBillingCampaign list error:', error);
            throw error;
        }
    }
}
exports.PrimeBillingCampaignRepo = PrimeBillingCampaignRepo;
