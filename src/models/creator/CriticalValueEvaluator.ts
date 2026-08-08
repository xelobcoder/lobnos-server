import { promisifyQuery, rowAffected } from "../../hooks/helper";
import KnexConnection from "../../database/KnexConnections";
import { insert_critical_value_alert } from "./queries";
import { NotificationDispatcher } from "../application/notifications/services/NotificationDispatcher";
import {
     buildCriticalAlertStatement,
     evaluateConditionRuleAgainstValue,
     normalizeConstraintType,
     normalizeParameterName,
     type ConditionRule,
     type LoggingConstraintType,
} from "./criticalValueAnalyzer";

export {
     evaluateConditionRuleAgainstValue,
     normalizeConstraintType,
     normalizeParameterName,
} from "./criticalValueAnalyzer";

/**
 * Critical-value analyzer + logger.
 *
 * Sources of truth (field_constraints is intentionally ignored):
 * - testconditiondefinitions  (condition groups)
 * - testconditions             (parameter rules)
 * - loggingcriticalvaluealert  (alert log)
 */
export class CriticalValueEvaluator {
     public static async criticalValueDetermination(
          tenantId: number,
          testid: number,
          billingid: number,
          ascensionId: number,
          fields: Array<{ field: string; value: any; fieldid?: any;[key: string]: any }>,
          employeeid: number,
     ): Promise<Array<{ field: string; value: any; fieldid?: any;[key: string]: any }>> {
          if (!Array.isArray(fields) || fields.length === 0) {
               return [];
          }

          const rules = await this.loadConditionRules(tenantId, testid);

          if (rules.length === 0) {
               return fields;
          }

          let alertsLogged = 0;

          for (const singleField of fields) {
               const field = singleField?.field;
               const fieldValue = singleField?.value;
               const fieldid = singleField?.fieldid;

               if (field === undefined || field === null || field === "") {
                    continue;
               }
               if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                    continue;
               }

               const matchingRules = rules.filter(
                    (rule) => normalizeParameterName(rule.parameter) === normalizeParameterName(field),
               );

               if (matchingRules.length === 0) {
                    continue;
               }

               for (const rule of matchingRules) {
                    const normalizedConstraint = normalizeConstraintType(rule.conditionConstraint);
                    const isHit = evaluateConditionRuleAgainstValue(rule, fieldValue);

                    if (!isHit) {
                         continue;
                    }
                    const logged = await this.logConditionCriticalValue(
                         tenantId,
                         testid,
                         billingid,
                         employeeid,
                         ascensionId,
                         rule,
                         String(field),
                         fieldValue,
                    );
                    if (logged) alertsLogged += 1;
               }
          }

          return fields;
     }

     private static async loadConditionRules(tenantId: number, testid: number): Promise<ConditionRule[]> {
          try {
               const connection = await KnexConnection(tenantId);
               const rows = await connection("testconditions as tc")
                    .leftJoin("testconditiondefinitions as td", "td.id", "tc.conditionId")
                    .where("tc.testId", testid)
                    .select(
                         "tc.id",
                         "tc.testId",
                         "tc.parameter",
                         "tc.conditionId",
                         "tc.target",
                         "tc.inRange",
                         "tc.conditionConstraint",
                         "td.conditionName",
                    );

               return Array.isArray(rows) ? (rows as ConditionRule[]) : [];
          } catch {
               return [];
          }
     }

     private static async logConditionCriticalValue(
          tenantId: number,
          testid: number,
          billingid: number,
          employeeid: number,
          ascensionId: number,
          rule: ConditionRule,
          field: string,
          value: unknown,
     ): Promise<boolean> {
          const constraintType = normalizeConstraintType(rule.conditionConstraint) || "null";
          const statement = buildCriticalAlertStatement(field, value, rule);

          return this.logCriticalValue(
               tenantId,
               testid,
               billingid,
               statement,
               employeeid,
               constraintType,
               ascensionId,
          );
     }

     protected static async logCriticalValue(
          tenantId: number,
          testid: number,
          billingid: number,
          statement: string,
          employeeid: number,
          constraintType: LoggingConstraintType = "null",
          ascensionId?: number,
     ): Promise<boolean> {
          const insertParams = [
               billingid,
               testid,
               constraintType,
               statement,
               employeeid,
               ascensionId || null,
          ];

          try {
               const result = await promisifyQuery(tenantId, insert_critical_value_alert, insertParams);
               const ok = rowAffected(result);

               if (ok) {
                    NotificationDispatcher.dispatch(
                         tenantId,
                         "CRITICAL_RESULT",
                         { billingId: billingid },
                         employeeid || undefined,
                         { context: { testid, statement, constraintType } },
                    ).catch(() => undefined);
               }

               return ok;
          } catch {
               return false;
          }
     }
}
