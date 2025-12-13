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
        this.getsServicePaymentHistory = async (serviceid) => {
            try {
                const conn = await this.connection;
                const paymentHistory = await conn('commission_batch_payment_services as cbps')
                    .leftJoin("commission_tracking as ct", "ct.serviceid", "cbps.serviceid ")
                    .select(("cbps.*"), ("ct.commission_percentage"), ("ct.type"), ("ct.recipient_id"))
                    .where('cbps.serviceid', serviceid);
                return paymentHistory;
            }
            catch (error) {
                logger_1.default.error('Error fetching service payment history:', error);
                throw error;
            }
        };
        this.getBatchPaymentServices = async (batchid) => {
            try {
                const conn = await this.connection;
                const services = await conn('commission_batch_payment_services as cbps')
                    .leftJoin("commission_tracking as ct", "ct.serviceid", "cbps.serviceid ")
                    .select(("cbps.*"), ("ct.commission_percentage"), ("ct.type"), ("ct.recipient_id"))
                    .where('cbps.batch_payment_id', batchid);
                return services;
            }
            catch (error) {
                logger_1.default.error('Error fetching batch payment services:', error);
                throw error;
            }
        };
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
    async getUnbatchedServicesFromList(serviceIds) {
        try {
            const conn = await this.connection;
            const existingServices = await conn('dboservices')
                .whereIn('serviceid', serviceIds)
                .select('serviceid');
            const existingIds = existingServices.map((row) => row.serviceid);
            const invalidIds = serviceIds.filter(id => !existingIds.includes(id));
            if (invalidIds.length > 0) {
                throw new Error(`Invalid service IDs: ${invalidIds.join(', ')}. These services do not exist in the database.`);
            }
            const batchedServices = await conn('commission_batch_payment_services')
                .whereIn('serviceid', serviceIds)
                .select('serviceid');
            const batchedIds = batchedServices.map((row) => row.serviceid);
            if (batchedIds.length > 0) {
                throw new Error(`Some services have already been batched for commission payment: ${batchedIds.join(', ')}. Cannot proceed with this batch.`);
            }
            if (serviceIds.length > 0) {
                for (const serviceId of serviceIds) {
                    const notCommissioned = await new CommissionTrackingRepository_1.CommissionTrackingRepo(this.tenantId).validateServiceTrackedMultiple([serviceId]);
                    if (notCommissioned.length > 0) {
                        await new CommissionTrackingRepository_1.CommissionTrackingRepo(this.tenantId).calculateCommissionDue(notCommissioned);
                    }
                }
            }
            return serviceIds;
        }
        catch (error) {
            logger_1.default.error('Error getting unbached services from list:', error);
            throw error;
        }
    }
}
exports.CommissionBatchPaymentServicesRepo = CommissionBatchPaymentServicesRepo;
