"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CriticalValueEvaluator = void 0;
const helper_1 = require("../../hooks/helper");
const FieldConstraintsRepository_repo_1 = __importDefault(require("../TestCreation/repositories/FieldConstraintsRepository.repo"));
const queries_1 = require("./queries");
const ResultLockRepository_1 = require("./Repo/ResultLockRepository");
const NotificationDispatcher_1 = require("../application/notifications/services/NotificationDispatcher");
class CriticalValueEvaluator {
    static isCriticalValueHitInConstraint(constraint, value, field, tenantId, addtionalfields) {
        const { constraint_type, value: constraintValue } = constraint;
        switch (constraint_type) {
            case "less": {
                const result = this.evaluateIsNumber(value, constraintValue);
                if (!Array.isArray(result))
                    return undefined;
                return this.criticalEvaluationLessThanConstraint(result, field, value, constraint, addtionalfields, tenantId);
            }
            case "greater": {
                const result = this.evaluateIsNumber(value, constraintValue);
                if (!Array.isArray(result))
                    return undefined;
                return this.criticalEvaluationGreaterThanConstraint(result, field, value, constraint, addtionalfields, tenantId);
            }
            case "match": {
                const result = this.evaluateIsNumber(value, constraintValue);
                if (!Array.isArray(result))
                    return undefined;
                return this.criticalEvaluationEqualToConstraints(result, field, value, constraint, addtionalfields, tenantId);
            }
            case "notmatch": {
                return this.criticalEvaluationNoMatchConstraints(field, value, constraint, addtionalfields, tenantId);
            }
            case "contains": {
                return this.criticalEvaluationContainsConstraints(constraint, value, field, addtionalfields, tenantId);
            }
            case "between": {
                let min, max;
                if (typeof constraintValue === "string" && constraintValue.includes("-")) {
                    const [minStr, maxStr] = constraintValue.split("-");
                    min = parseFloat(minStr);
                    max = parseFloat(maxStr);
                }
                else if (Array.isArray(constraintValue) && constraintValue.length === 2) {
                    min = parseFloat(constraintValue[0]);
                    max = parseFloat(constraintValue[1]);
                }
                else {
                    return value;
                }
                return this.criticalEvaluationBetweenConstraints(value, min, max, field, constraint, addtionalfields, tenantId);
            }
            default:
                return value;
        }
    }
    static evaluateIsNumber(value, constraintValue) {
        const isNotNumber = isNaN(value) || isNaN(constraintValue);
        if (isNotNumber)
            return false;
        const castedValues = parseFloat(value);
        const castedConstraitValue = parseFloat(constraintValue);
        return [castedValues, castedConstraitValue];
    }
    static criticalEvaluationBetweenConstraints(value, min, max, field, constraints, additionalfield, tenantId) {
        const numValue = parseFloat(value);
        const isHit = numValue >= min && numValue <= max;
        return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
    }
    static criticalEvaluationContainsConstraints(constraints, value, field, additionalfield, tenantId) {
        const { value: constraintValue } = constraints;
        const isHit = typeof value === "string" && typeof constraintValue === "string" && value.includes(constraintValue);
        return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
    }
    static criticalEvaluationNoMatchConstraints(field, value, constraints, additionalfield, tenantId) {
        const { value: constraintValue } = constraints;
        const isHit = value !== constraintValue;
        return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
    }
    static criticalEvaluationEqualToConstraints(result, field, value, constraints, additionalfield, tenantId) {
        const [castedValue, castedConstraintValue] = result;
        const isHit = castedValue == castedConstraintValue;
        return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
    }
    static generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId, others) {
        const { value: constraintValue, action } = constraints;
        if (isHit) {
            const statement = this.alertStatementGenerator(field, constraintValue, constraints.constraint_type, isHit, action, value, others);
            const currentValue = this.CriticalActionCarrier(constraints, value, additionalfield, tenantId, statement);
            return currentValue;
        }
    }
    static criticalEvaluationGreaterThanConstraint(result, field, value, constraints, additionalfield, tenantId) {
        const [castedValue, castedConstraintValue] = result;
        const isHit = castedValue > castedConstraintValue;
        return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
    }
    static criticalEvaluationLessThanConstraint(result, field, value, constraint, addtionalfields, tenantId) {
        const [castedValue, castedConstraintValue] = result;
        const isHit = castedValue < castedConstraintValue;
        return this.generataStatementAndEaluate(isHit, field, value, constraint, addtionalfields, tenantId);
    }
    static alertStatementGenerator(field, constraintValue, constraint_type, isHit, action, value, others) {
        if (!isHit)
            return undefined;
        switch (constraint_type) {
            case "less":
                return `Critical Value Occurred. Parameter or field ${field} with value ${value} is less than ${constraintValue}, action ${action} has triggered. Please Kindly Take Action`;
            case "greater":
                return `Critical Value Occurred. Parameter or field ${field} with value ${value} is greater than ${constraintValue}, action ${action} has triggered. Please Kindly Take Action`;
            case "match":
                return `Critical Value Occurred. Parameter or field ${field} with value ${value} is equal to value ${constraintValue} being monitored, action ${action} has triggered. Please Kindly Take Action`;
            case "notmatch":
                return `Critical Value Occurred. Parameter or field ${field} does not match the constraint value ${constraintValue}, action ${action} has triggered. Please Kindly Take Action`;
            case "contains":
                return `Critical Value Occurred. Parameter or field ${field} contains constraint value ${constraintValue}, please kindly take action`;
            case "between":
                const { min, max } = others;
                return `Critical Value Occurred. Parameter or field ${field} with value ${value} is between ${min} and ${max} action ${action} has triggered. Please Kindly Take Action`;
            default:
                return undefined;
        }
    }
    static CriticalActionCarrier(fieldConstraints, value, addtionalfields, tenantId, statement) {
        const { action, replacement_text, prefix, suffix } = fieldConstraints;
        const { billingid, testid, employeeid, ascensionId } = addtionalfields;
        if (!value || value.toString().length < 1)
            return value;
        switch (action) {
            case "replace": {
                if (replacement_text)
                    return replacement_text;
                return value;
            }
            case "prefix": {
                if (prefix)
                    return prefix + " " + value;
                return value;
            }
            case "suffix": {
                if (suffix)
                    return value + " " + suffix;
                return value;
            }
            case "prefix-suffix": {
                if (prefix && suffix)
                    return prefix + " " + value + " " + suffix;
                return value;
            }
            case "lock-result": {
                if (ascensionId) {
                    new ResultLockRepository_1.ResultLockRepository(tenantId).updateLockStatusOnly(ascensionId, true);
                }
                return value;
            }
            case "do_not_alert":
            case "alert":
                if (statement) {
                    this.logCriticalValue(tenantId, testid, billingid, statement, employeeid);
                }
                return value;
            case "none":
            default:
                return value;
        }
    }
    static async criticalValueDetermination(tenantId, testid, billingid, ascensionId, fields, employeeid) {
        if (!Array.isArray(fields) || fields.length == 0)
            return [];
        const currentTestFieldsConstraints = await new FieldConstraintsRepository_repo_1.default(tenantId).findByTestId(testid);
        if (Array.isArray(currentTestFieldsConstraints) && currentTestFieldsConstraints.length === 0)
            return fields;
        for (let j = 0; j < fields.length; j++) {
            const singleField = fields[j];
            const field = singleField['field'];
            const fieldValue = singleField['value'];
            const currentFieldId = singleField['fieldid'];
            const currentFieldConstraints = currentTestFieldsConstraints.filter((_contrainsts) => _contrainsts.fieldid == currentFieldId);
            if (currentFieldConstraints && Array.isArray(currentFieldConstraints) && currentFieldConstraints.length > 0) {
                if (!(field && fieldValue))
                    continue;
                for (let i = 0; i < currentFieldConstraints.length; i++) {
                    if (currentFieldConstraints[i]['action'] == "none")
                        continue;
                    const newValue = this.isCriticalValueHitInConstraint(currentFieldConstraints[i], fieldValue, field, tenantId, {
                        testid,
                        billingid,
                        employeeid,
                        ascensionId
                    });
                    if (newValue)
                        fields[j]['value'] = newValue;
                }
            }
        }
        return fields;
    }
    static async logCriticalValue(tenantId, testid, billingid, statement, employeeid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.insert_critical_value_alert, [billingid, testid, statement, employeeid]);
        const ok = (0, helper_1.rowAffected)(result);
        if (ok) {
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'CRITICAL_RESULT', { billingId: billingid }, employeeid || undefined, { context: { testid, statement } }).catch(() => { });
        }
        return ok;
    }
}
exports.CriticalValueEvaluator = CriticalValueEvaluator;
