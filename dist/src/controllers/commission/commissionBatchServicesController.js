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
                const { startDate, endDate, commissionDue, amountPaid, paymentMethod, employeeid, branchid, recipientid, recipient_type, services } = request.body;
                const parseDate = (dateStr) => {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10);
                        const year = parseInt(parts[2], 10);
                        return new Date(year, month - 1, day);
                    }
                    return new Date(dateStr);
                };
                const startDateObj = parseDate(startDate);
                const endDateObj = parseDate(endDate);
                if (!branchid || !employeeid || !recipientid || !recipient_type) {
                    return (0, helper_1.customError)("Missing required fields: branchid, employeeid, recipientid, recipient_type", 400, response);
                }
                if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return (0, helper_1.customError)("Invalid date format", 400, response);
                }
                if (startDateObj > endDateObj) {
                    return (0, helper_1.customError)("Start date cannot be after end date", 400, response);
                }
                const eligibleServices = await batchServicesRepo.getUnbatchedServicesFromList(services);
                if (eligibleServices.length === 0) {
                    return (0, helper_1.customError)("No eligible services from the provided list", 400, response);
                }
                logger_1.default.info(`Processing batch payment for ${eligibleServices.length} eligible services: ${eligibleServices.join(', ')}`);
                const processPayment = await new CommissionBatchPaymentsRepo_1.CommissionBatchPaymentsRepo(this.tenantId).createBatchPaymentWithServices({
                    startDate: startDateObj,
                    endDate: endDateObj,
                    commissionDue,
                    amountPaid,
                    services: eligibleServices,
                    employeeid,
                    branchid,
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
        this.getBatchBreakdown = async (request, response) => {
            try {
                const { batchid } = request.params;
                const batchPaymentsRepo = new CommissionBatchPaymentServicesRepo_1.CommissionBatchPaymentServicesRepo(this.tenantId);
                const batchBreakdown = await batchPaymentsRepo.getBatchPaymentServices(parseInt(batchid));
                return response.send({
                    status: true,
                    message: "Batch breakdown retrieved successfully",
                    data: batchBreakdown
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching batch breakdown:', error);
                return (0, helper_1.customError)("Failed to fetch batch breakdown", 500, response);
            }
        };
        this.tenantId = tenantId;
    }
    async getBatchInformation(request, response) {
        try {
            const { batchid, recipient_id, recipient_type, startDate, endDate, page, count, sortby } = request.query;
            const batchPaymentsRepo = new CommissionBatchPaymentsRepo_1.CommissionBatchPaymentsRepo(this.tenantId);
            const batchInfo = await batchPaymentsRepo.getBatch({
                batchid: parseInt(batchid),
                page: page ? parseInt(page) : 1,
                count: count ? parseInt(count) : 10,
                sortby: sortby === 'ASC' ? 'ASC' : 'DESC',
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
    async getServiceCommissionPaymentHistory(request, response) {
        try {
            const { serviceid } = request.params;
            const commissionTrackingRepo = new CommissionBatchPaymentServicesRepo_1.CommissionBatchPaymentServicesRepo(this.tenantId);
            const paymentHistory = await commissionTrackingRepo.getsServicePaymentHistory(parseInt(serviceid));
            return response.send({
                status: true,
                message: "Service commission payment history retrieved successfully",
                data: paymentHistory
            });
        }
        catch (error) {
            logger_1.default.error('Error fetching service commission payment history:', error);
            return (0, helper_1.customError)("Failed to fetch service commission payment history", 500, response);
        }
    }
}
exports.CommissionBatchServicesController = CommissionBatchServicesController;
