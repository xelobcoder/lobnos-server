"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionServiceFactory = void 0;
const CommissionEngineService_1 = require("./CommissionEngineService");
const CommissionConfigRepository_1 = require("../repositories/CommissionConfigRepository");
const CommissionTierRepository_1 = require("../repositories/CommissionTierRepository");
const CommissionAssignmentRepository_1 = require("../repositories/CommissionAssignmentRepository");
const CommissionTrackingRepository_1 = require("../repositories/CommissionTrackingRepository");
/**
 * Factory for creating CommissionEngineService with all dependencies
 */
class CommissionServiceFactory {
    static createEngine(tenantId, trx) {
        const configRepo = new CommissionConfigRepository_1.CommissionConfigRepository(tenantId);
        const tierRepo = new CommissionTierRepository_1.CommissionTierRepository(tenantId);
        const assignmentRepo = new CommissionAssignmentRepository_1.CommissionAssignmentRepository(tenantId);
        const trackingRepo = new CommissionTrackingRepository_1.CommissionTrackingRepository(tenantId, trx);
        return new CommissionEngineService_1.CommissionEngineService(configRepo, tierRepo, assignmentRepo, trackingRepo);
    }
    static createConfigRepository(tenantId) {
        return new CommissionConfigRepository_1.CommissionConfigRepository(tenantId);
    }
    static createTierRepository(tenantId) {
        return new CommissionTierRepository_1.CommissionTierRepository(tenantId);
    }
    static createAssignmentRepository(tenantId) {
        return new CommissionAssignmentRepository_1.CommissionAssignmentRepository(tenantId);
    }
    static createTrackingRepository(tenantId, trx) {
        return new CommissionTrackingRepository_1.CommissionTrackingRepository(tenantId, trx);
    }
}
exports.CommissionServiceFactory = CommissionServiceFactory;
