"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const user_1 = __importDefault(require("../../../LobnosAuth/user"));
class DiscountLimitService {
    static allowedRoles() {
        return new Set([
            'crm',
            'customer representative',
            'customer service representative',
            'manager',
            'accountant',
            'admin',
            'super-admin',
            'superadmin',
            'super admin'
        ]);
    }
    static normalizeRole(role) {
        if (!role)
            return null;
        return String(role).trim().toLowerCase().replace(/\s+/g, ' ');
    }
    static getNextRoleInHierarchy(currentRole) {
        if (!currentRole)
            return null;
        const hierarchy = ['customer service representative', 'manager', 'accountant', 'admin', 'super-admin', 'superadmin', 'super admin'];
        const idx = hierarchy.indexOf(currentRole);
        if (idx === -1)
            return null;
        return hierarchy[idx + 1] || null;
    }
    static todayLocalISODate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    static async getRoleLimitInfo(opts) {
        const { tenantId, employeeid, trx } = opts;
        const conn = trx || (await (0, KnexConnections_1.default)(tenantId));
        const roleRaw = await new user_1.default().getUserRole(employeeid, tenantId);
        const role = DiscountLimitService.normalizeRole(roleRaw);
        const allowedRole = role ? DiscountLimitService.allowedRoles().has(role) : false;
        const usageDate = DiscountLimitService.todayLocalISODate();
        if (!role || !allowedRole) {
            return {
                role,
                allowedRole,
                ruleFound: false,
                rule: null,
                usageDate,
                dailyUsedDiscount: 0,
                dailyRemainingDiscount: null,
                dailyUsedSurcharge: 0,
                dailyRemainingSurcharge: null
            };
        }
        const rule = await conn('discount_limit_rules')
            .where({ role, is_active: 1 })
            .first();
        const currentUsage = await conn('discount_daily_usage')
            .where({ usage_date: usageDate, employeeid, role })
            .first();
        const dailyUsedDiscount = currentUsage ? Number(currentUsage.discount_total || 0) : 0;
        const dailyUsedSurcharge = currentUsage ? Number(currentUsage.surcharge_total || 0) : 0;
        const maxDiscountDay = rule && rule.max_discount_per_day != null ? Number(rule.max_discount_per_day) : null;
        const maxSurchargeDay = rule && rule.max_surcharge_per_day != null ? Number(rule.max_surcharge_per_day) : null;
        return {
            role,
            allowedRole,
            ruleFound: !!rule,
            rule: rule || null,
            usageDate,
            dailyUsedDiscount,
            dailyRemainingDiscount: maxDiscountDay == null ? null : Math.max(0, Number((maxDiscountDay - dailyUsedDiscount).toFixed(2))),
            dailyUsedSurcharge,
            dailyRemainingSurcharge: maxSurchargeDay == null ? null : Math.max(0, Number((maxSurchargeDay - dailyUsedSurcharge).toFixed(2)))
        };
    }
    static async enforceAndRecord(opts) {
        const { tenantId, trx, employeeid, billingid, subtotal, payable, discountTotal, surchargeTotal, branchid } = opts;
        let dTotal = Math.abs(Number(discountTotal || 0));
        let sTotal = Math.abs(Number(surchargeTotal || 0));
        if (!isFinite(dTotal))
            dTotal = 0;
        if (!isFinite(sTotal))
            sTotal = 0;
        if (dTotal <= 0 && sTotal <= 0)
            return;
        const roleRaw = await new user_1.default().getUserRole(employeeid, tenantId);
        const role = DiscountLimitService.normalizeRole(roleRaw);
        if (!role)
            throw new Error('Unable to determine employee role for discount validation.');
        if (!DiscountLimitService.allowedRoles().has(role))
            throw new Error('Your role is not permitted to apply discounts or surcharges.');
        const rule = await trx('discount_limit_rules')
            .where({ role, is_active: 1 })
            .first();
        if (!rule && role !== 'admin')
            throw new Error('No discount limit rule configured for your role. Please contact admin.');
        const baseAmount = typeof subtotal === 'number' ? subtotal : (typeof payable === 'number' ? payable : null);
        const minDiscountTotal = rule.min_transaction_total_for_discount != null ? Number(rule.min_transaction_total_for_discount) : null;
        const maxDiscountTxn = rule.max_discount_per_transaction != null ? Number(rule.max_discount_per_transaction) : null;
        const maxDiscountDay = rule.max_discount_per_day != null ? Number(rule.max_discount_per_day) : null;
        const minSurchargeTotal = rule.min_transaction_total_for_surcharge != null ? Number(rule.min_transaction_total_for_surcharge) : null;
        const maxSurchargeTxn = rule.max_surcharge_per_transaction != null ? Number(rule.max_surcharge_per_transaction) : null;
        const maxSurchargeDay = rule.max_surcharge_per_day != null ? Number(rule.max_surcharge_per_day) : null;
        if (dTotal > 0) {
            if (minDiscountTotal != null && baseAmount != null && baseAmount < minDiscountTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Discount not allowed at your level for this transaction.`);
            }
            if (maxDiscountTxn != null && dTotal > maxDiscountTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Discount exceeds your per-transaction limit.`);
            }
        }
        if (sTotal > 0) {
            if (minSurchargeTotal != null && baseAmount != null && baseAmount < minSurchargeTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Surcharge not allowed at your level for this transaction.`);
            }
            if (maxSurchargeTxn != null && sTotal > maxSurchargeTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Surcharge exceeds your per-transaction limit.`);
            }
        }
        const usageDate = DiscountLimitService.todayLocalISODate();
        const currentUsage = await trx('discount_daily_usage')
            .where({ usage_date: usageDate, employeeid, role })
            .first();
        const currentDiscount = currentUsage ? Number(currentUsage.discount_total || 0) : 0;
        const currentSurcharge = currentUsage ? Number(currentUsage.surcharge_total || 0) : 0;
        if (dTotal > 0 && maxDiscountDay != null && currentDiscount + dTotal > maxDiscountDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily discount limit reached for your level. Please escalate to ${nextRole}.` : `Daily discount limit reached for your level.`);
        }
        if (sTotal > 0 && maxSurchargeDay != null && currentSurcharge + sTotal > maxSurchargeDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily surcharge limit reached for your level. Please escalate to ${nextRole}.` : `Daily surcharge limit reached for your level.`);
        }
        await trx('discount_adjustment_log').insert({
            billingid,
            employeeid,
            role,
            branchid: branchid !== null && branchid !== void 0 ? branchid : null,
            subtotal: typeof subtotal === 'number' ? subtotal : null,
            payable: typeof payable === 'number' ? payable : null,
            discount_total: dTotal,
            surcharge_total: sTotal,
            occurred_at: trx.fn.now()
        });
        if (currentUsage) {
            await trx('discount_daily_usage')
                .where({ usage_date: usageDate, employeeid, role })
                .update({
                discount_total: trx.raw('discount_total + ?', [dTotal]),
                surcharge_total: trx.raw('surcharge_total + ?', [sTotal]),
                updated_at: trx.fn.now()
            });
        }
        else {
            await trx('discount_daily_usage').insert({
                usage_date: usageDate,
                employeeid,
                role,
                discount_total: dTotal,
                surcharge_total: sTotal,
                created_at: trx.fn.now(),
                updated_at: trx.fn.now()
            });
        }
    }
    static async enforceOnly(opts) {
        const { tenantId, employeeid, subtotal, payable, discountTotal, surchargeTotal } = opts;
        let dTotal = Math.abs(Number(discountTotal || 0));
        let sTotal = Math.abs(Number(surchargeTotal || 0));
        if (!isFinite(dTotal))
            dTotal = 0;
        if (!isFinite(sTotal))
            sTotal = 0;
        if (dTotal <= 0 && sTotal <= 0)
            return;
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const roleRaw = await new user_1.default().getUserRole(employeeid, tenantId);
        const role = DiscountLimitService.normalizeRole(roleRaw);
        if (!role)
            throw new Error('Unable to determine employee role for discount validation.');
        if (!DiscountLimitService.allowedRoles().has(role))
            throw new Error('Your role is not permitted to apply discounts or surcharges.');
        const rule = await conn('discount_limit_rules')
            .where({ role, is_active: 1 })
            .first();
        if (!rule)
            throw new Error('No discount limit rule configured for your role. Please contact admin.');
        const baseAmount = typeof subtotal === 'number' ? subtotal : (typeof payable === 'number' ? payable : null);
        const minDiscountTotal = rule.min_transaction_total_for_discount != null ? Number(rule.min_transaction_total_for_discount) : null;
        const maxDiscountTxn = rule.max_discount_per_transaction != null ? Number(rule.max_discount_per_transaction) : null;
        const maxDiscountDay = rule.max_discount_per_day != null ? Number(rule.max_discount_per_day) : null;
        const minSurchargeTotal = rule.min_transaction_total_for_surcharge != null ? Number(rule.min_transaction_total_for_surcharge) : null;
        const maxSurchargeTxn = rule.max_surcharge_per_transaction != null ? Number(rule.max_surcharge_per_transaction) : null;
        const maxSurchargeDay = rule.max_surcharge_per_day != null ? Number(rule.max_surcharge_per_day) : null;
        if (dTotal > 0) {
            if (minDiscountTotal != null && baseAmount != null && baseAmount < minDiscountTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Discount not allowed at your level for this transaction.`);
            }
            if (maxDiscountTxn != null && dTotal > maxDiscountTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Discount exceeds your per-transaction limit.`);
            }
        }
        if (sTotal > 0) {
            if (minSurchargeTotal != null && baseAmount != null && baseAmount < minSurchargeTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Surcharge not allowed at your level for this transaction.`);
            }
            if (maxSurchargeTxn != null && sTotal > maxSurchargeTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Surcharge exceeds your per-transaction limit.`);
            }
        }
        const usageDate = DiscountLimitService.todayLocalISODate();
        const currentUsage = await conn('discount_daily_usage')
            .where({ usage_date: usageDate, employeeid, role })
            .first();
        const currentDiscount = currentUsage ? Number(currentUsage.discount_total || 0) : 0;
        const currentSurcharge = currentUsage ? Number(currentUsage.surcharge_total || 0) : 0;
        if (dTotal > 0 && maxDiscountDay != null && currentDiscount + dTotal > maxDiscountDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily discount limit reached for your level. Please escalate to ${nextRole}.` : `Daily discount limit reached for your level.`);
        }
        if (sTotal > 0 && maxSurchargeDay != null && currentSurcharge + sTotal > maxSurchargeDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily surcharge limit reached for your level. Please escalate to ${nextRole}.` : `Daily surcharge limit reached for your level.`);
        }
    }
}
exports.default = DiscountLimitService;
