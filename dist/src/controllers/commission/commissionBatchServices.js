"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionBatchServicesController = void 0;
const CommissionBatchPaymentServicesRepo_1 = require("../../models/commissions/CommissionBatchPaymentServicesRepo");
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
class CommissionBatchServicesController {
    constructor(tenantId) {
        this.processServiceBatching = async (request, response) => {
            try {
                const batchServicesRepo = new CommissionBatchPaymentServicesRepo_1.CommissionBatchPaymentServicesRepo(this.tenantId);
                const { startDate, endDate, commissionDue, amountPaid } = request.body;
                //  validate the dates andd ensure there are actual dates 
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return (0, helper_1.customError)("Invalid date format", 400, response);
                }
                if (startDateObj > endDateObj) {
                    return (0, helper_1.customError)("Start date cannot be after end date", 400, response);
                }
                // get all services within the date range that match the commission type
                const isBatched = await batchServicesRepo.isDateRangeBatched(startDate, endDate);
                if (isBatched) {
                    return (0, helper_1.customError)("Some services have in the specified date range have already been batched for commission payment and processed ", 400, response);
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
}
exports.CommissionBatchServicesController = CommissionBatchServicesController;
