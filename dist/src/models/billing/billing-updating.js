"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingUpdatingService = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const billing_shared_1 = require("./billing_shared");
class BillingUpdatingService {
    /**
     * Update a billing record, handling new/deleted/changed tests and services, and recalculating all summary fields.
     */
    static async updateClientBilling(tenantId, billingID, newBillingData) {
        let trx;
        try {
            // --- VALIDATION BLOCK ---
            // 1. Validate billing ID exists
            const billingExists = await billing_shared_1.BillingSharedRepo.checkValidityOfBillingID(billingID, tenantId);
            if (!billingExists) {
                return { status: false, message: "Invalid or non-existent billing ID." };
            }
            // 2. Validate request body structure and patient existence
            const validBody = await billing_shared_1.BillingSharedRepo.validateBillingRequestBody(newBillingData, tenantId);
            if (validBody !== true) {
                return { status: false, message: `Invalid billing update request: ${String(validBody)}` };
            }
            // --- END VALIDATION BLOCK ---
            const db = await (0, KnexConnections_1.default)(tenantId);
            trx = await db.transaction();
            // 1. Load current tests/services for this billingID
            const currentEntries = await trx("dboservices").where("billingid", billingID);
            const currentTestIds = currentEntries.filter((e) => e.trackId && (!e.serviceCategory || e.serviceCategory !== "SERVICES")).map((e) => e.trackId);
            const currentServiceIds = currentEntries.filter((e) => e.trackId && e.serviceCategory === "SERVICES").map((e) => e.trackId);
            // 2. Determine new, deleted, and unchanged tests/services
            const newTestIds = (newBillingData.cart || []).map((item) => item.testid);
            const newServiceIds = (newBillingData.servicesProvided || []).map((item) => item.keyid);
            const testsToAdd = (newBillingData.cart || []).filter((item) => !currentTestIds.includes(item.testid));
            const testsToRemove = currentTestIds.filter((id) => !newTestIds.includes(id));
            const servicesToAdd = (newBillingData.servicesProvided || []).filter((item) => !currentServiceIds.includes(item.keyid));
            const servicesToRemove = currentServiceIds.filter((id) => !newServiceIds.includes(id));
            // 3. Remove deleted tests/services
            if (testsToRemove.length > 0) {
                await trx("dboservices").where("billingid", billingID).whereIn("trackId", testsToRemove).andWhere(function () { this.whereNull("serviceCategory").orWhereNot("serviceCategory", "SERVICES"); }).del();
            }
            if (servicesToRemove.length > 0) {
                await trx("dboservices").where("billingid", billingID).whereIn("trackId", servicesToRemove).andWhere("serviceCategory", "SERVICES").del();
            }
            // 4. Add new tests/services using instance methods
            const Multi = new billing_shared_1.BillingSharedRepo();
            if (testsToAdd.length > 0) {
                const testEntries = await billing_shared_1.BillingSharedRepo.processTestCart(tenantId, Object.assign(Object.assign({}, newBillingData), { cart: testsToAdd }), billingID, newBillingData.taxValue, newBillingData.taxList || null, trx);
                await Multi.mapAndInsertServices(tenantId, testEntries, billingID, trx);
            }
            if (servicesToAdd.length > 0) {
                const mappedServicesToAdd = servicesToAdd.map((item) => ({
                    serviceName: item.serviceName || '',
                    servicePrice: item.servicePrice || 0,
                    discount: item.discount || 0,
                    originalValue: item.originalValue || 0,
                    totalcost: item.totalcost || 0,
                    totalDiscount: item.totalDiscount || 0,
                    payable: item.payable || 0,
                    amountIncurredDueTax: item.amountIncurredDueTax || 0,
                    totalServiceCost: item.totalServiceCost || 0,
                    hasNightAdjustment: item.hasNightAdjustment || false,
                    nightAdjustmentMode: item.nightAdjustmentMode || 'none',
                    nightAdjustmentValue: item.nightAdjustmentValue || 0,
                    isPackageUsed: item.isPackageUsed || false,
                    packageid: item.packageid || null,
                    keyid: item.keyid,
                    discountedValue: item.discountedValue || 0,
                }));
                const serviceEntries = await billing_shared_1.BillingSharedRepo.processNonTestServices(newBillingData, mappedServicesToAdd, billingID, newBillingData.taxValue, newBillingData.taxList || null);
                await Multi.mapAndInsertServices(tenantId, serviceEntries, billingID, trx);
            }
            // 5. Recalculate all summary fields using the latest logic
            const allDbEntries = await trx("dboservices").where("billingid", billingID);
            const testDbEntries = allDbEntries.filter((e) => !e.serviceCategory || e.serviceCategory !== "SERVICES");
            const serviceDbEntries = allDbEntries.filter((e) => e.serviceCategory === "SERVICES");
            // 6. Update billing record
            const updateData = {
                totalTransactionCost: billingFinalValues.totalcost,
                totalcost: billingFinalValues.totalcost,
                paid: newBillingData.paid,
                payable: billingFinalValues.payable,
                discount: billingFinalValues.totalDiscount,
                amountIncurredDueTax: billingFinalValues.amountIncurredDueTax,
                outstanding: billingFinalValues.outstanding,
                balance: billingFinalValues.balance,
                totalrefunded: 0,
                lastUpdated: new Date(), // Track when the update occurred
                updatedBy: newBillingData.employeeid || null // Track who performed the update
            };
            const result = await trx("billing").where("billingid", billingID).update(updateData);
            if (!result)
                throw new Error("unable to update billing record");
            // 7. Insert billing history for each payment (if payments array exists)
            if (Array.isArray(newBillingData.payments) && newBillingData.payments.length > 0) {
                for (const payment of newBillingData.payments) {
                    const paymentMode = payment.mode;
                    const paymentAmount = payment.amount;
                    const employeeId = payment.employeeid || newBillingData.employeeid;
                    if (!paymentMode || !employeeId) {
                        throw new Error("Missing mode or employeeid in payment record.");
                    }
                    await billing_shared_1.BillingSharedRepo.insertBillHistory(trx, billingID, paymentMode, paymentAmount, employeeId, "credit");
                }
            }
            else {
                // Fallback: single payment
                await billing_shared_1.BillingSharedRepo.insertBillHistory(trx, billingID, newBillingData.paymentmode, newBillingData.paid, newBillingData.employeeid, "credit");
            }
            await trx.commit();
            return { status: true, message: "Billing updated successfully" };
        }
        catch (error) {
            if (trx)
                await trx.rollback();
            return { status: false, message: error && error.message ? error.message : "Unknown error in billing update" };
        }
    }
}
exports.BillingUpdatingService = BillingUpdatingService;
