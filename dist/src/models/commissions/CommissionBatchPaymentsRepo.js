"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionBatchPaymentsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
class CommissionBatchPaymentsRepo {
    constructor(tenantId) {
        this.createBatchPayment = async (batchPayment) => {
            try {
                const conn = await this.connection;
                // validate required fields
                if (!batchPayment.batch_reference || !batchPayment.recipient_type || !batchPayment.recipient_id ||
                    !batchPayment.start_date || !batchPayment.end_date || batchPayment.total_commission_amount === undefined ||
                    batchPayment.payment_amount === undefined || !batchPayment.created_by) {
                    throw new Error('Missing required fields for creating batch payment');
                }
                const [id] = await conn('commission_batch_payments').insert(batchPayment);
                return id;
            }
            catch (error) {
                logger_1.default.error('Error creating batch payment:', error);
                throw error;
            }
        };
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
}
exports.CommissionBatchPaymentsRepo = CommissionBatchPaymentsRepo;
