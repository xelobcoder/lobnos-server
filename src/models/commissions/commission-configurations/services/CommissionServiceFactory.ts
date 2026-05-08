import { CommissionEngineService } from './CommissionEngineService';
import { CommissionConfigRepository } from '../repositories/CommissionConfigRepository';
import { CommissionTierRepository } from '../repositories/CommissionTierRepository';
import { CommissionAssignmentRepository } from '../repositories/CommissionAssignmentRepository';
import { CommissionTrackingRepository } from '../repositories/CommissionTrackingRepository';

/**
 * Factory for creating CommissionEngineService with all dependencies
 */
export class CommissionServiceFactory {
     static createEngine(tenantId: number, trx?: any): CommissionEngineService {
          const configRepo = new CommissionConfigRepository(tenantId);
          const tierRepo = new CommissionTierRepository(tenantId);
          const assignmentRepo = new CommissionAssignmentRepository(tenantId);
          const trackingRepo = new CommissionTrackingRepository(tenantId, trx);

          return new CommissionEngineService(tenantId, configRepo, tierRepo, assignmentRepo, trackingRepo);
     }

     static createConfigRepository(tenantId: number): CommissionConfigRepository {
          return new CommissionConfigRepository(tenantId);
     }

     static createTierRepository(tenantId: number): CommissionTierRepository {
          return new CommissionTierRepository(tenantId);
     }

     static createAssignmentRepository(tenantId: number): CommissionAssignmentRepository {
          return new CommissionAssignmentRepository(tenantId);
     }

     static createTrackingRepository(tenantId: number, trx?: any): CommissionTrackingRepository {
          return new CommissionTrackingRepository(tenantId, trx);
     }
}
