export class CommissionEngineError extends Error {
     constructor(
          message: string,
          public code: string,
          public statusCode: number = 500
     ) {
          super(message);
          this.name = 'CommissionEngineError';
          Object.setPrototypeOf(this, CommissionEngineError.prototype);
     }
}

export class ConfigNotFoundError extends CommissionEngineError {
     constructor(configId: number) {
          super(
               `Commission config ${configId} not found`,
               'CONFIG_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, ConfigNotFoundError.prototype);
     }
}

export class TierNotFoundError extends CommissionEngineError {
     constructor(configId: number, amount: number) {
          super(
               `No tier found for config ${configId} with amount ${amount}`,
               'TIER_NOT_FOUND',
               400
          );
          Object.setPrototypeOf(this, TierNotFoundError.prototype);
     }
}

export class ServiceNotFoundError extends CommissionEngineError {
     constructor(serviceId: number) {
          super(
               `Service ${serviceId} not found`,
               'SERVICE_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, ServiceNotFoundError.prototype);
     }
}

export class AssignmentNotFoundError extends CommissionEngineError {
     constructor(assignmentId: number) {
          super(
               `Commission assignment ${assignmentId} not found`,
               'ASSIGNMENT_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, AssignmentNotFoundError.prototype);
     }
}

export class InvalidCommissionConfigError extends CommissionEngineError {
     constructor(message: string, public details?: Record<string, any>) {
          super(message, 'INVALID_CONFIG', 400);
          Object.setPrototypeOf(this, InvalidCommissionConfigError.prototype);
     }
}

export class InvalidTierConfigError extends CommissionEngineError {
     constructor(message: string, configId?: number) {
          super(
               `Invalid tier configuration${configId ? ` for config ${configId}` : ''}: ${message}`,
               'INVALID_TIER_CONFIG',
               400
          );
          Object.setPrototypeOf(this, InvalidTierConfigError.prototype);
     }
}

export class DuplicateTierError extends CommissionEngineError {
     constructor(configId: number) {
          super(
               `Overlapping tier boundaries detected for config ${configId}`,
               'DUPLICATE_TIER',
               400
          );
          Object.setPrototypeOf(this, DuplicateTierError.prototype);
     }
}

export class NoCommissionConfigFoundError extends CommissionEngineError {
     constructor(serviceId: number, context?: Record<string, any>) {
          super(
               `No commission configuration found for service ${serviceId}`,
               'NO_CONFIG_FOUND',
               400
          );
          this.context = context;
          Object.setPrototypeOf(this, NoCommissionConfigFoundError.prototype);
     }

     context?: Record<string, any>;
}

export class CalculationError extends CommissionEngineError {
     constructor(message: string, public operation?: string) {
          super(message, 'CALCULATION_ERROR', 500);
          Object.setPrototypeOf(this, CalculationError.prototype);
     }
}

export class DatabaseError extends CommissionEngineError {
     constructor(message: string, public originalError?: any) {
          super(message, 'DATABASE_ERROR', 500);
          Object.setPrototypeOf(this, DatabaseError.prototype);
     }
}
