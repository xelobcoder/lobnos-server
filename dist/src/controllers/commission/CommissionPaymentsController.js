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
class CommissionTrackingController {
    constructor(tenantId) {
        this.commissionTrackingRepo = new CommissionTrackingRepository_1.CommissionTrackingRepository(tenantId);
    }
    async getCommissionTrackingByType(request, response) {
        const repo = this.commissionTrackingRepo;
        async function validate() {
            const { registrationType, page, count, recipient_id } = request.query;
            if (registrationType && !['clinician', 'organization'].includes(registrationType)) {
                return (0, helper_1.customError)("Type must be either 'clinician' or 'organization'", 400, response);
            }
            try {
                const tracking = await repo.getCommissionTrackingByType(registrationType, page ? parseInt(page.toString()) : undefined, count ? parseInt(count.toString()) : undefined, recipient_id ? parseInt(recipient_id.toString()) : undefined);
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
}
exports.CommissionTrackingController = CommissionTrackingController;
