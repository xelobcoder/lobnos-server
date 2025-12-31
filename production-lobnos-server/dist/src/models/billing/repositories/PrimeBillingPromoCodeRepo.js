"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeBillingPromoCodeRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class PrimeBillingPromoCodeRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        try {
            const conn = await this.connection;
            const [id] = await conn('prime_billing_promo_codes').insert(data);
            return id;
        }
        catch (error) {
            console.error('PrimeBillingPromoCode create error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_promo_codes').where({ id }).first();
        }
        catch (error) {
            console.error('PrimeBillingPromoCode findById error:', error);
            throw error;
        }
    }
    async findByCode(code) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_promo_codes').where({ code }).first();
        }
        catch (error) {
            console.error('PrimeBillingPromoCode findByCode error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_promo_codes').where({ id }).update(updates);
        }
        catch (error) {
            console.error('PrimeBillingPromoCode update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn('prime_billing_promo_codes').where({ id }).delete();
        }
        catch (error) {
            console.error('PrimeBillingPromoCode delete error:', error);
            throw error;
        }
    }
    async list(campaign_id) {
        try {
            const conn = await this.connection;
            let query = conn('prime_billing_promo_codes');
            if (campaign_id) {
                query = query.where({ campaign_id });
            }
            return await query;
        }
        catch (error) {
            console.error('PrimeBillingPromoCode list error:', error);
            throw error;
        }
    }
    /**
     * Increment the times_used for a promo code by 1.
     */
    async incrementUsage(id, trx) {
        try {
            const conn = trx || await this.connection;
            return await conn('prime_billing_promo_codes')
                .where({ id })
                .increment('times_used', 1);
        }
        catch (error) {
            console.error('PrimeBillingPromoCode incrementUsage error:', error);
            throw error;
        }
    }
    /**
     * Update promo code details without affecting times_used.
     */
    async updateDetails(id, updates) {
        try {
            const conn = await this.connection;
            // Remove times_used if present in updates
            const _a = updates, { times_used } = _a, rest = __rest(_a, ["times_used"]);
            return await conn('prime_billing_promo_codes').where({ id }).update(rest);
        }
        catch (error) {
            console.error('PrimeBillingPromoCode updateDetails error:', error);
            throw error;
        }
    }
    /**
     * Validate a promo code: is active, within date, and not exceeded max uses.
     */
    async validatePromoCode(code, now = new Date()) {
        try {
            const conn = await this.connection;
            const promo = await conn('prime_billing_promo_codes').where({ code }).first();
            if (!promo)
                return { valid: false, reason: 'Promo code not found' };
            if (!promo.is_active)
                return { valid: false, reason: 'Promo code is not active' };
            if (promo.valid_from && new Date(promo.valid_from) > now)
                return { valid: false, reason: 'Promo code not yet valid' };
            if (promo.valid_to && new Date(promo.valid_to) < now)
                return { valid: false, reason: 'Promo code expired' };
            if (promo.max_uses !== null && promo.max_uses !== undefined && promo.times_used >= promo.max_uses) {
                return { valid: false, reason: 'Promo code usage limit reached' };
            }
            return { valid: true, promo };
        }
        catch (error) {
            console.error('PrimeBillingPromoCode validatePromoCode error:', error);
            throw error;
        }
    }
}
exports.PrimeBillingPromoCodeRepo = PrimeBillingPromoCodeRepo;
