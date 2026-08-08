"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CriticalValueEvaluator = exports.normalizeParameterName = exports.normalizeConstraintType = exports.evaluateConditionRuleAgainstValue = void 0;
const helper_1 = require("../../hooks/helper");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const queries_1 = require("./queries");
const NotificationDispatcher_1 = require("../application/notifications/services/NotificationDispatcher");
const criticalValueAnalyzer_1 = require("./criticalValueAnalyzer");
var criticalValueAnalyzer_2 = require("./criticalValueAnalyzer");
Object.defineProperty(exports, "evaluateConditionRuleAgainstValue", { enumerable: true, get: function () { return criticalValueAnalyzer_2.evaluateConditionRuleAgainstValue; } });
Object.defineProperty(exports, "normalizeConstraintType", { enumerable: true, get: function () { return criticalValueAnalyzer_2.normalizeConstraintType; } });
Object.defineProperty(exports, "normalizeParameterName", { enumerable: true, get: function () { return criticalValueAnalyzer_2.normalizeParameterName; } });
/**
 * Critical-value analyzer + logger.
 *
 * Sources of truth (field_constraints is intentionally ignored):
 * - testconditiondefinitions  (condition groups)
 * - testconditions             (parameter rules)
 * - loggingcriticalvaluealert  (alert log)
 */
class CriticalValueEvaluator {
    static async criticalValueDetermination(tenantId, testid, billingid, ascensionId, fields, employeeid) {
        if (!Array.isArray(fields) || fields.length === 0) {
            return [];
        }
        const rules = await this.loadConditionRules(tenantId, testid);
        if (rules.length === 0) {
            return fields;
        }
        let alertsLogged = 0;
        for (const singleField of fields) {
            const field = singleField === null || singleField === void 0 ? void 0 : singleField.field;
            const fieldValue = singleField === null || singleField === void 0 ? void 0 : singleField.value;
            const fieldid = singleField === null || singleField === void 0 ? void 0 : singleField.fieldid;
            if (field === undefined || field === null || field === "") {
                continue;
            }
            if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                continue;
            }
            const matchingRules = rules.filter((rule) => (0, criticalValueAnalyzer_1.normalizeParameterName)(rule.parameter) === (0, criticalValueAnalyzer_1.normalizeParameterName)(field));
            if (matchingRules.length === 0) {
                continue;
            }
            for (const rule of matchingRules) {
                const normalizedConstraint = (0, criticalValueAnalyzer_1.normalizeConstraintType)(rule.conditionConstraint);
                const isHit = (0, criticalValueAnalyzer_1.evaluateConditionRuleAgainstValue)(rule, fieldValue);
                if (!isHit) {
                    continue;
                }
                const logged = await this.logConditionCriticalValue(tenantId, testid, billingid, employeeid, ascensionId, rule, String(field), fieldValue);
                if (logged)
                    alertsLogged += 1;
            }
        }
        return fields;
    }
    static async loadConditionRules(tenantId, testid) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const rows = await connection("testconditions as tc")
                .leftJoin("testconditiondefinitions as td", "td.id", "tc.conditionId")
                .where("tc.testId", testid)
                .select("tc.id", "tc.testId", "tc.parameter", "tc.conditionId", "tc.target", "tc.inRange", "tc.conditionConstraint", "td.conditionName");
            return Array.isArray(rows) ? rows : [];
        }
        catch (_a) {
            return [];
        }
    }
    static async logConditionCriticalValue(tenantId, testid, billingid, employeeid, ascensionId, rule, field, value) {
        const constraintType = (0, criticalValueAnalyzer_1.normalizeConstraintType)(rule.conditionConstraint) || "null";
        const statement = (0, criticalValueAnalyzer_1.buildCriticalAlertStatement)(field, value, rule);
        return this.logCriticalValue(tenantId, testid, billingid, statement, employeeid, constraintType, ascensionId);
    }
    static async logCriticalValue(tenantId, testid, billingid, statement, employeeid, constraintType = "null", ascensionId) {
        const insertParams = [
            billingid,
            testid,
            constraintType,
            statement,
            employeeid,
            ascensionId || null,
        ];
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.insert_critical_value_alert, insertParams);
            const ok = (0, helper_1.rowAffected)(result);
            if (ok) {
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, "CRITICAL_RESULT", { billingId: billingid }, employeeid || undefined, { context: { testid, statement, constraintType } }).catch(() => undefined);
            }
            return ok;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.CriticalValueEvaluator = CriticalValueEvaluator;
