"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = exports.CalculationError = exports.NoCommissionConfigFoundError = exports.DuplicateTierError = exports.InvalidTierConfigError = exports.InvalidCommissionConfigError = exports.AssignmentNotFoundError = exports.ServiceNotFoundError = exports.TierNotFoundError = exports.ConfigNotFoundError = exports.CommissionEngineError = void 0;
class CommissionEngineError extends Error {
    constructor(message, code, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'CommissionEngineError';
        Object.setPrototypeOf(this, CommissionEngineError.prototype);
    }
}
exports.CommissionEngineError = CommissionEngineError;
class ConfigNotFoundError extends CommissionEngineError {
    constructor(configId) {
        super(`Commission config ${configId} not found`, 'CONFIG_NOT_FOUND', 404);
        Object.setPrototypeOf(this, ConfigNotFoundError.prototype);
    }
}
exports.ConfigNotFoundError = ConfigNotFoundError;
class TierNotFoundError extends CommissionEngineError {
    constructor(configId, amount) {
        super(`No tier found for config ${configId} with amount ${amount}`, 'TIER_NOT_FOUND', 400);
        Object.setPrototypeOf(this, TierNotFoundError.prototype);
    }
}
exports.TierNotFoundError = TierNotFoundError;
class ServiceNotFoundError extends CommissionEngineError {
    constructor(serviceId) {
        super(`Service ${serviceId} not found`, 'SERVICE_NOT_FOUND', 404);
        Object.setPrototypeOf(this, ServiceNotFoundError.prototype);
    }
}
exports.ServiceNotFoundError = ServiceNotFoundError;
class AssignmentNotFoundError extends CommissionEngineError {
    constructor(assignmentId) {
        super(`Commission assignment ${assignmentId} not found`, 'ASSIGNMENT_NOT_FOUND', 404);
        Object.setPrototypeOf(this, AssignmentNotFoundError.prototype);
    }
}
exports.AssignmentNotFoundError = AssignmentNotFoundError;
class InvalidCommissionConfigError extends CommissionEngineError {
    constructor(message, details) {
        super(message, 'INVALID_CONFIG', 400);
        this.details = details;
        Object.setPrototypeOf(this, InvalidCommissionConfigError.prototype);
    }
}
exports.InvalidCommissionConfigError = InvalidCommissionConfigError;
class InvalidTierConfigError extends CommissionEngineError {
    constructor(message, configId) {
        super(`Invalid tier configuration${configId ? ` for config ${configId}` : ''}: ${message}`, 'INVALID_TIER_CONFIG', 400);
        Object.setPrototypeOf(this, InvalidTierConfigError.prototype);
    }
}
exports.InvalidTierConfigError = InvalidTierConfigError;
class DuplicateTierError extends CommissionEngineError {
    constructor(configId) {
        super(`Overlapping tier boundaries detected for config ${configId}`, 'DUPLICATE_TIER', 400);
        Object.setPrototypeOf(this, DuplicateTierError.prototype);
    }
}
exports.DuplicateTierError = DuplicateTierError;
class NoCommissionConfigFoundError extends CommissionEngineError {
    constructor(serviceId, context) {
        super(`No commission configuration found for service ${serviceId}`, 'NO_CONFIG_FOUND', 400);
        this.context = context;
        Object.setPrototypeOf(this, NoCommissionConfigFoundError.prototype);
    }
}
exports.NoCommissionConfigFoundError = NoCommissionConfigFoundError;
class CalculationError extends CommissionEngineError {
    constructor(message, operation) {
        super(message, 'CALCULATION_ERROR', 500);
        this.operation = operation;
        Object.setPrototypeOf(this, CalculationError.prototype);
    }
}
exports.CalculationError = CalculationError;
class DatabaseError extends CommissionEngineError {
    constructor(message, originalError) {
        super(message, 'DATABASE_ERROR', 500);
        this.originalError = originalError;
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
exports.DatabaseError = DatabaseError;
