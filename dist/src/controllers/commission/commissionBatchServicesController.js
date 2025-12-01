"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionBatchServicesController = void 0;
const CommissionBatchPaymentServicesRepo_1 = require("../../models/commissions/CommissionBatchPaymentServicesRepo");
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const CommissionBatchPaymentsRepo_1 = require("../../models/commissions/CommissionBatchPaymentsRepo");
class CommissionBatchServicesController {
    constructor(tenantId) {
        this.processServiceBatching = async (request, response) => {
            try {
                const batchServicesRepo = new CommissionBatchPaymentServicesRepo_1.CommissionBatchPaymentServicesRepo(this.tenantId);
                const { startDate, endDate, commissionDue, amountPaid, paymentMethod, employeeid, recipientid, recipient_type } = request.body;
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return (0, helper_1.customError)("Invalid date format", 400, response);
                }
                if (startDateObj > endDateObj) {
                    return (0, helper_1.customError)("Start date cannot be after end date", 400, response);
                }
                const isBatched = await batchServicesRepo.isDateRangeBatched(startDate, endDate, recipientid, recipient_type);
                if (typeof isBatched === "boolean" && isBatched === true) {
                    return (0, helper_1.customError)("Some services have in the specified date range have already been batched for commission payment and processed ", 400, response);
                }
                const processPayment = await new CommissionBatchPaymentsRepo_1.CommissionBatchPaymentsRepo(this.tenantId).createBatchPaymentWithServices({
                    startDate: startDateObj,
                    endDate: endDateObj,
                    commissionDue,
                    amountPaid,
                    services: isBatched,
                    employeeid,
                    paymentMethod,
                    recipientId: recipientid,
                    recipientType: recipient_type
                });
                if (!processPayment) {
                    return (0, helper_1.customError)("Failed to process service batching", 500, response);
                }
                return response.send({
                    status: true,
                    message: "Service batching validation successful. Services can be batched.",
                    data: {}
                });
            }
            catch (error) {
                logger_1.default.error('Error processing service batching:', error);
                return false;
            }
        };
        this.tenantId = tenantId;
    }
    async getBatchInformation(request, response) {
        try {
            const { batchid, recipient_id, recipient_type, startDate, endDate } = request.query;
            const batchPaymentsRepo = new CommissionBatchPaymentsRepo_1.CommissionBatchPaymentsRepo(this.tenantId);
            const batchInfo = await batchPaymentsRepo.getBatch({
                batchid: parseInt(batchid),
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                recipient_id: recipient_id ? parseInt(recipient_id) : undefined,
                recipient_type: recipient_type ? recipient_type : undefined
            });
            return response.send({
                status: true,
                message: "Batch information retrieved successfully",
                data: batchInfo
            });
        }
        catch (error) {
            logger_1.default.error('Error fetching batch information:', error);
            return (0, helper_1.customError)("Failed to fetch batch information", 500, response);
        }
    }
}
exports.CommissionBatchServicesController = CommissionBatchServicesController;
