import { TransactionManagementRepository } from "./TransactionManagementRepository";
import { TransactionManagementService } from "./TransactionManagementService";

/**
 * Factory for creating TransactionManagementService with its dependencies
 */
export class TransactionManagementFactory {
    /**
     * Creates an instance of TransactionManagementService
     * @param tenantId The tenant ID for database connection
     * @returns A new TransactionManagementService instance
     */
    static createService(tenantId: number): TransactionManagementService {
        const repository = new TransactionManagementRepository(tenantId);
        return new TransactionManagementService(repository, tenantId);
    }

    /**
     * Creates an instance of TransactionManagementRepository
     * @param tenantId The tenant ID for database connection
     * @returns A new TransactionManagementRepository instance
     */
    static createRepository(tenantId: number): TransactionManagementRepository {
        return new TransactionManagementRepository(tenantId);
    }
}
