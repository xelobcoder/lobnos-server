"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTrackingController = void 0;
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const CommissionTrackingRepository_1 = require("../../models/commissions/CommissionTrackingRepository");
const trycatch_1 = require("../../models/generics/trycatch");
const CommissionBatchPaymentServicesRepo_1 = require("../../models/commissions/CommissionBatchPaymentServicesRepo");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class CommissionTrackingController {
    constructor(tenantId) {
        this.commissionTrackingRepo = new CommissionTrackingRepository_1.CommissionTrackingRepo(tenantId);
        this.batchServicesRepo = new CommissionBatchPaymentServicesRepo_1.CommissionBatchPaymentServicesRepo(tenantId);
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async getCommissionTrackingByType(request, response) {
        const commissionTrackingRepo = this.commissionTrackingRepo;
        async function validate() {
            const { registrationType, page, count, recipient_id } = request.query;
            if (registrationType && !['clinician', 'organization'].includes(registrationType)) {
                return (0, helper_1.customError)("Type must be either 'clinician' or 'organization'", 400, response);
            }
            try {
                const tracking = await commissionTrackingRepo.getCommissionTrackingByType(registrationType, page ? parseInt(page.toString()) : undefined, count ? parseInt(count.toString()) : undefined, recipient_id ? parseInt(recipient_id.toString()) : undefined);
                return response.send({
                    status: true,
                    message: "Commission tracking retrieved successfully",
                    data: tracking
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission tracking by type:', error);
                return (0, helper_1.customError)("Failed to fetch commission tracking", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async updateCommissionTracking(request, response) {
        try {
            const { id } = request.params;
            const { serviceId, newCommissionAmount: commissionRate, recipientType, recipientId } = request.body;
            if (!serviceId || !commissionRate || !recipientType || !recipientId) {
                return (0, helper_1.customError)("Missing required fields", 400, response);
            }
            if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
                return (0, helper_1.customError)("Commission rate must be a number between 0 and 100", 400, response);
            }
            const commissionId = parseInt(id.toString());
            const commissionTrackingRepo = this.commissionTrackingRepo;
            const batchServicesRepo = this.batchServicesRepo;
            const conn = await this.connection;
            const isBatched = await batchServicesRepo.isServiceBatched(serviceId);
            if (isBatched)
                return (0, helper_1.customError)("Cannot update commission rate for a service that is already included in a batch payment", 400, response);
            const totalpayable = await conn('dboservices')
                .where('serviceid', serviceId)
                .first()
                .then((row) => row ? parseFloat(row.totalpayable) : 0);
            const newCommissionAmount = parseFloat(((totalpayable * commissionRate) / 100).toFixed(2));
            const updates = {
                commission_percentage: commissionRate,
                type: recipientType,
                recipient_id: recipientId,
                commission_due: newCommissionAmount,
                calculated_at: new Date(),
                updated_at: new Date()
            };
            await commissionTrackingRepo.updateCommissionTracking(commissionId, updates);
            return response.send({
                status: true,
                message: "Commission tracking updated successfully"
            });
        }
        catch (error) {
            logger_1.default.error('Error updating commission tracking:', error);
            return (0, helper_1.customError)("Failed to update commission tracking", 500, response);
        }
    }
    async getUntrackedServices(request, response) {
        try {
            const { recipient_type, recipient_id, page, count } = request.query;
            let recipientType;
            let recipientId;
            let pageNum;
            let countNum;
            if (recipient_type) {
                if (!['clinician', 'organization'].includes(recipient_type)) {
                    return (0, helper_1.customError)("recipient_type must be either 'clinician' or 'organization'", 400, response);
                }
                recipientType = recipient_type;
            }
            if (recipient_id) {
                const parsedId = parseInt(recipient_id);
                if (isNaN(parsedId)) {
                    return (0, helper_1.customError)("recipient_id must be a valid number", 400, response);
                }
                recipientId = parsedId;
            }
            if (page) {
                const parsedPage = parseInt(page);
                if (isNaN(parsedPage) || parsedPage < 1) {
                    return (0, helper_1.customError)("page must be a positive integer", 400, response);
                }
                pageNum = parsedPage;
            }
            if (count) {
                const parsedCount = parseInt(count);
                if (isNaN(parsedCount) || parsedCount < 1) {
                    return (0, helper_1.customError)("count must be a positive integer", 400, response);
                }
                countNum = parsedCount;
            }
            const untrackedServices = await this.commissionTrackingRepo.getUntrackedServices(recipientType, recipientId, pageNum, countNum);
            return response.send({
                status: true,
                message: "Untracked services retrieved successfully",
                data: untrackedServices
            });
        }
        catch (error) {
            logger_1.default.error('Error fetching untracked services:', error);
            return (0, helper_1.customError)("Failed to fetch untracked services", 500, response);
        }
    }
    async addUntrackedService(request, response) {
        try {
            const { serviceid, recipient_type, recipient_id } = request.body;
            if (!serviceid || !recipient_type || !recipient_id) {
                return (0, helper_1.customError)("Missing required fields: serviceid, recipient_type, recipient_id", 400, response);
            }
            if (!['clinician', 'organization'].includes(recipient_type)) {
                return (0, helper_1.customError)("recipient_type must be either 'clinician' or 'organization'", 400, response);
            }
            const recipientId = parseInt(recipient_id.toString());
            if (isNaN(recipientId)) {
                return (0, helper_1.customError)("recipient_id must be a valid number", 400, response);
            }
            const serviceId = parseInt(serviceid.toString());
            if (isNaN(serviceId)) {
                return (0, helper_1.customError)("serviceid must be a valid number", 400, response);
            }
            const result = await this.commissionTrackingRepo.insertUntrackedService(serviceId, recipient_type, recipientId);
            return response.send({
                status: true,
                message: "Untracked service inserted successfully",
                data: result
            });
        }
        catch (error) {
            logger_1.default.error('Error inserting untracked service:', error);
            return (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || "Failed to insert untracked service", 500, response);
        }
    }
}
exports.CommissionTrackingController = CommissionTrackingController;
