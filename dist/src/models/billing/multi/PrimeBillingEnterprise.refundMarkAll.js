"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllServicesAndBillingAsRefunded = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
/**
 * Efficiently marks all services under a billing as refunded, updating all relevant fields for audit and reporting.
 * - Sets all service totals to 0 except totalRefunded (set to original price).
 * - Updates billing: status='voided', totalpaid=0, outstanding=0, totalcost=0, islocked=1.
 * - Leaves billing.totaltransactioncost unchanged (for audit trail).
 * - All updates are transactional for consistency.
 * @param tenantId Tenant identifier
 * @param billingid Billing ID
 * @param employeeid Employee performing the operation
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function markAllServicesAndBillingAsRefunded(tenantId, billingid, employeeid) {
    const knex = await (0, KnexConnections_1.default)(tenantId);
    const trx = await knex.transaction();
    try {
        // 1. Get all services for this billing
        const services = await trx('dboservices').where({ billingid }).select('*');
        if (!services || services.length === 0) {
            await trx.rollback();
            return false;
        }
        // 2. For each service, set all cost fields to 0 except totalRefunded (set to original price)
        for (const service of services) {
            await trx('dboservices')
                .where({ serviceid: service.serviceid })
                .update({
                totalpayable: 0,
                totalcost: 0,
                cost: 0,
                price: 0,
                amountIncurredDueTax: 0,
                discount: 0,
                promoDiscount: 0,
                totalRefunded: service.totalpayable || service.totalcost || service.price || 0
            });
        }
        // 3. Mark all related refund records as completed (if not already)
        await trx('dbobillingrefundtable')
            .whereIn('serviceid', services.map(s => s.serviceid))
            .update({ isRefundCompleted: 1 });
        // 4. Update billing table: status, paid, outstanding, cost, islocked
        await trx('billing')
            .where({ billingid })
            .update({
            status: 'voided',
            totalpaid: 0.0,
            outstanding: 0,
            totalcost: 0,
            islocked: 1
            // totaltransactioncost is NOT changed
        });
        await trx.commit();
        return true;
    }
    catch (err) {
        await trx.rollback();
        return false;
    }
}
exports.markAllServicesAndBillingAsRefunded = markAllServicesAndBillingAsRefunded;
