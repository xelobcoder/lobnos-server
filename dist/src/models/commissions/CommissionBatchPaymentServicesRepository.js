"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionBatchPaymentServicesRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
class CommissionBatchPaymentServicesRepository {
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
}
exports.CommissionBatchPaymentServicesRepository = CommissionBatchPaymentServicesRepository;
