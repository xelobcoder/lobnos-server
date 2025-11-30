"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTrackingController = void 0;
const helper_1 = require("../../hooks/helper");
const trycatch_1 = require("../../models/generics/trycatch");
const CommissionTrackingRepository_1 = require("../../models/commissions/CommissionTrackingRepository");
const logger_1 = __importDefault(require("../../hooks/logger"));
class CommissionTrackingController {
    constructor(tenantId) {
        this.repo = new CommissionTrackingRepository_1.CommissionTrackingRepository(tenantId);
    }
    async getCommissionTrackingById(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionTrackingController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid tracking ID is required", 400, response);
            }
            try {
                const tracking = await controller.repo.getCommissionTrackingById(parseInt(id));
                if (!tracking) {
                    return (0, helper_1.customError)("Commission tracking not found", 404, response);
                }
                return response.send({
                    status: true,
                    message: "Commission tracking retrieved successfully",
                    data: tracking
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission tracking:', error);
                return (0, helper_1.customError)("Failed to fetch commission tracking", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionTrackingByType(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { type } = request.params;
            const { limit } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionTrackingController(tenantIdP);
            if (!['clinician', 'organization'].includes(type)) {
                return (0, helper_1.customError)("Type must be either 'clinician' or 'organization'", 400, response);
            }
            try {
                const tracking = await controller.repo.getCommissionTrackingByType(type, limit ? parseInt(limit.toString()) : undefined);
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
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionTrackingController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid tracking ID is required", 400, response);
            }
            const updateData = request.body;
            delete updateData.id;
            delete updateData.created_at;
            try {
                const result = await controller.repo.updateCommissionTracking(parseInt(id), updateData);
                if (result === 0) {
                    return (0, helper_1.customError)("Commission tracking not found", 404, response);
                }
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
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
}
exports.CommissionTrackingController = CommissionTrackingController;
