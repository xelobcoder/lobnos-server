/**
 * Commission Configuration Module
 * Central export point for all commission-related classes and utilities
 */

// Interfaces
export {
     ICommissionConfig,
     CommissionConfig,
} from './interfaces/CommissionConfig.interface';
export {
     ICommissionTier,
     CommissionTier,
     type TierType,
} from './interfaces/CommissionTier.interface';
export {
     ICommissionAssignment,
     CommissionAssignment,
     type ScopeType,
} from './interfaces/CommissionAssignment.interface';
export {
     ICommissionTracking,
     CommissionTracking,
     type CommissionStatus,
     type CommissionType,
     type RecipientType,
} from './interfaces/CommissionTracking.interface';
export {
     CommissionInput,
     CommissionCalculationResult,
     ResolvedCommission,
     CapAdjustments,
     PeriodCapContext,
     CommissionValidationError,
} from './interfaces/index';


export {
     CommissionAssignmentRepository,
} from './repositories/CommissionAssignmentRepository';
export {
     ICommissionTrackingRepository,
} from './repositories/ICommissionTrackingRepository';
export {
     CommissionTrackingRepository,
} from './repositories/CommissionTrackingRepository';

// Services
export {
     CommissionEngineService,
} from './services/CommissionEngineService';
export {
     CommissionResolutionService,
} from './services/CommissionResolutionService';
export {
     CommissionCapService,
} from './services/CommissionCapService';
export {
     CommissionServiceFactory,
} from './services/CommissionServiceFactory';

// Utilities
export {
     CommissionCalculator,
} from './utils/CommissionCalculator';
export {
     CommissionValidator,
} from './utils/CommissionValidator';
export {
     PeriodHelper,
} from './utils/PeriodHelper';
export {
     CommissionLogger,
     logger,
} from './utils/CommissionLogger';

// Errors
export {
     CommissionEngineError,
     ConfigNotFoundError,
     TierNotFoundError,
     ServiceNotFoundError,
     AssignmentNotFoundError,
     InvalidCommissionConfigError,
     InvalidTierConfigError,
     DuplicateTierError,
     NoCommissionConfigFoundError,
     CalculationError,
     DatabaseError,
} from './errors/CommissionErrors';
