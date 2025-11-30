"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionBatchPaymentServicesRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const CommissionTrackingRepository_1 = require("./CommissionTrackingRepository");
class CommissionBatchPaymentServicesRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async isServiceBatched(serviceid) {
        try {
            const conn = await this.connection;
            const result = await conn('commission_batch_payment_services')
                .where('serviceid', serviceid)
                .first();
            return !!result;
        }
        catch (error) {
            logger_1.default.error('Error checking if service is batched:', error);
            throw error;
        }
    }
    async isDateRangeBatched(startDate, endDate) {
        try {
            //  get all serivesid within the date range
            const conn = await this.connection;
            const results = await conn.raw(`
                    SELECT * FROM dboservices
                    WHERE DATE(serviceAddedOn) >= ? AND DATE(serviceAddedOn) <= ?
               `, [startDate, endDate]);
            if (results[0].length === 0) {
                throw new Error('No services found in the specified date range');
            }
            const serviceIds = results[0].map((row) => row.serviceid);
            const isBatched = await conn('commission_batch_payment_services')
                .whereIn('serviceid', serviceIds)
                .first();
            if (isBatched)
                return true;
            const allNotCommissioned = await new CommissionTrackingRepository_1.CommissionTrackingRepo(this.tenantId).validateServiceTrackedMultiple(serviceIds);
            if (allNotCommissioned.length > 0) {
                const createCommmission = await new CommissionTrackingRepository_1.CommissionTrackingRepo(this.tenantId).calculateCommissionDue(allNotCommissioned);
                console.log("Commission created for untracked services during batching validation: ", createCommmission);
            }
            return false;
        }
        catch (error) {
            logger_1.default.error('Error validating date range:', error);
            throw error;
        }
    }
}
exports.CommissionBatchPaymentServicesRepo = CommissionBatchPaymentServicesRepo;
