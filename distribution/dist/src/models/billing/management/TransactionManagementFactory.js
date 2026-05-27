"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManagementFactory = void 0;
const TransactionManagementRepository_1 = require("./TransactionManagementRepository");
const TransactionManagementService_1 = require("./TransactionManagementService");
/**
 * Factory for creating TransactionManagementService with its dependencies
 */
class TransactionManagementFactory {
    /**
     * Creates an instance of TransactionManagementService
     * @param tenantId The tenant ID for database connection
     * @returns A new TransactionManagementService instance
     */
    static createService(tenantId) {
        const repository = new TransactionManagementRepository_1.TransactionManagementRepository(tenantId);
        return new TransactionManagementService_1.TransactionManagementService(repository);
    }
    /**
     * Creates an instance of TransactionManagementRepository
     * @param tenantId The tenant ID for database connection
     * @returns A new TransactionManagementRepository instance
     */
    static createRepository(tenantId) {
        return new TransactionManagementRepository_1.TransactionManagementRepository(tenantId);
    }
}
exports.TransactionManagementFactory = TransactionManagementFactory;
