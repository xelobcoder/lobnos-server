import { promisifyQuery, rowAffected } from "../../hooks/helper";
import FieldConstraintsRepository from "../TestCreation/FieldConstraintsRepository";
import { insert_critical_value_alert } from "./queries";
import { ResultLockRepository } from "./Repo/ResultLockRepository";

interface addtionalfields {
     testid: number,
     billingid: number,
     employeeid: number,
     ascensionId: number
}

export class CriticalValueEvaluator {

     private static isCriticalValueHitInConstraint(
          constraint: FieldConstraint,
          value: any,
          field: string,
          tenantId: number,
          addtionalfields: addtionalfields
     ): string | undefined {
          const { constraint_type, value: constraintValue } = constraint
          switch (constraint_type) {
               case "less": {
                    const result = this.evaluateIsNumber(value, constraintValue);
                    if (!Array.isArray(result)) return undefined
                    return this.criticalEvaluationLessThanConstraint(result, field, value, constraint, addtionalfields, tenantId);
               }
               case "greater": {
                    const result = this.evaluateIsNumber(value, constraintValue);
                    if (!Array.isArray(result)) return undefined
                    return this.criticalEvaluationGreaterThanConstraint(result, field, value, constraint, addtionalfields, tenantId);
               }
               case "match": {
                    const result = this.evaluateIsNumber(value, constraintValue);
                    if (!Array.isArray(result)) return undefined
                    return this.criticalEvaluationEqualToConstraints(result, field, value, constraint, addtionalfields, tenantId);
               }
               case "notmatch": {
                    return this.criticalEvaluationNoMatchConstraints(field, value, constraint, addtionalfields, tenantId);
               }
               case "contains": {
                    return this.criticalEvaluationContainsConstraints(constraint, value, field, addtionalfields, tenantId);
               }
               case "between": {
                    let min: number, max: number;
                    if (typeof constraintValue === "string" && constraintValue.includes("-")) {
                         const [minStr, maxStr] = constraintValue.split("-");
                         min = parseFloat(minStr);
                         max = parseFloat(maxStr);
                    } else if (Array.isArray(constraintValue) && constraintValue.length === 2) {
                         min = parseFloat(constraintValue[0]);
                         max = parseFloat(constraintValue[1]);
                    } else {
                         return value;
                    }
                    return this.criticalEvaluationBetweenConstraints(value, min, max, field, constraint, addtionalfields, tenantId);
               }
               default:
                    return value;
          }
     }

     private static evaluateIsNumber(value: any, constraintValue: any): number[] | false {
          const isNotNumber = isNaN(value) || isNaN(constraintValue);
          if (isNotNumber) return false;
          const castedValues = parseFloat(value);
          const castedConstraitValue = parseFloat(constraintValue);
          return [castedValues, castedConstraitValue];
     }

     private static criticalEvaluationBetweenConstraints(value: any, min: number, max: number, field: string, constraints: FieldConstraint, additionalfield: addtionalfields, tenantId: number) {
          const numValue = parseFloat(value);
          const isHit = numValue >= min && numValue <= max;
          return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
     }

     private static criticalEvaluationContainsConstraints(constraints: FieldConstraint, value: any, field: string, additionalfield: addtionalfields, tenantId: number) {
          const { value: constraintValue } = constraints;
          const isHit = typeof value === "string" && typeof constraintValue === "string" && value.includes(constraintValue);
          return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
     }

     private static criticalEvaluationNoMatchConstraints(field: string, value: any, constraints: FieldConstraint, additionalfield: addtionalfields, tenantId: number) {
          const { value: constraintValue } = constraints;
          const isHit = value !== constraintValue;
          return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
     }

     private static criticalEvaluationEqualToConstraints(result: number[], field: string, value: any, constraints: FieldConstraint, additionalfield: addtionalfields, tenantId: number) {
          const [castedValue, castedConstraintValue] = result;
          const isHit = castedValue == castedConstraintValue;
          return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
     }

     private static generataStatementAndEaluate(isHit: boolean, field: string, value: any, constraints: FieldConstraint, additionalfield: addtionalfields, tenantId: number, others?: { min: number, max: number }) {
          const { value: constraintValue, action } = constraints;
          if (isHit) {
               const statement = this.alertStatementGenerator(field, constraintValue, "greater", isHit, action, value, others);
               const currentValue = this.CriticalActionCarrier(constraints, value, additionalfield, tenantId, statement)
               return currentValue;
          }
     }

     private static criticalEvaluationGreaterThanConstraint(result: number[], field: string, value: any, constraints: FieldConstraint, additionalfield: addtionalfields, tenantId: number) {
          const [castedValue, castedConstraintValue] = result;
          const isHit = castedValue > castedConstraintValue;
          return this.generataStatementAndEaluate(isHit, field, value, constraints, additionalfield, tenantId);
     }

     private static criticalEvaluationLessThanConstraint(result: number[], field: string, value: any, constraint: FieldConstraint, addtionalfields: addtionalfields, tenantId: number) {
          const [castedValue, castedConstraintValue] = result;
          const isHit = castedValue < castedConstraintValue;
          return this.generataStatementAndEaluate(isHit, field, value, constraint, addtionalfields, tenantId);
     }

     private static alertStatementGenerator(field: string, constraintValue: any, constraint_type: FieldConstraint['constraint_type'], isHit: boolean, action: FieldConstraint['action'], value?: number, others?: { min: number, max: number }) {
          if (!isHit) return undefined;
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
                    const { min, max } = others
                    return `Critical Value Occurred. Parameter or field ${field} with value ${value} is between ${min} and ${max} action ${action} has triggered. Please Kindly Take Action`;
               default:
                    return undefined;
          }
     }

     private static CriticalActionCarrier(fieldConstraints: FieldConstraint, value: any, addtionalfields: addtionalfields, tenantId: number, statement: string) {
          const { action, replacement_text, prefix, suffix } = fieldConstraints;
          const { billingid, testid, employeeid, ascensionId } = addtionalfields
          if (!value || value.toString().length < 1) return value;

          switch (action) {
               case "replace": {
                    if (replacement_text) return replacement_text;
                    return value;
               }
               case "prefix": {
                    if (prefix) return prefix + " " + value;
                    return value;
               }
               case "suffix": {
                    if (suffix) return value + " " + suffix;
                    return value;
               }
               case "prefix-suffix": {
                    if (prefix && suffix) return prefix + " " + value + " " + suffix;
                    return value;
               }
               case "lock-result": {
                    if (ascensionId) {
                         new ResultLockRepository(tenantId).updateLockStatusOnly(ascensionId, true);
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

     public static async criticalValueDetermination(
          tenantId: number,
          testid: number,
          billingid: number,
          ascensionId: number,
          fields: Array<{ field: string, value: any, fieldid?: any, [key: string]: any }>,
          employeeid: number
     ): Promise<{ field: string, value: any, fieldid?: any, [key: string]: any }[]> {
          if (!Array.isArray(fields) || fields.length == 0) return [];

          const currentTestFieldsConstraints = await new FieldConstraintsRepository(tenantId).findByTestId(testid);
          if (Array.isArray(currentTestFieldsConstraints) && currentTestFieldsConstraints.length === 0) return fields;

          for (let j = 0; j < fields.length; j++) {
               const singleField = fields[j];
               const field = singleField['field'];
               const fieldValue = singleField['value'];
               const currentFieldId = singleField['fieldid'];

               const currentFieldConstraints = currentTestFieldsConstraints.filter((_contrainsts) => _contrainsts.fieldid == currentFieldId);
               if (currentFieldConstraints && Array.isArray(currentFieldConstraints) && currentFieldConstraints.length > 0) {
                    if (!(field && fieldValue)) continue;

                    for (let i = 0; i < currentFieldConstraints.length; i++) {
                         if (currentFieldConstraints[i]['action'] == "none") continue;
                         const newValue: undefined | string = this.isCriticalValueHitInConstraint(currentFieldConstraints[i], fieldValue, field, tenantId, {
                              testid,
                              billingid,
                              employeeid,
                              ascensionId
                         });
                         if (newValue) fields[j]['value'] = newValue;
                    }
               }
          }

          return fields;
     }

     protected static async logCriticalValue(tenantId: number, testid: number, billingid: number, statement: string, employeeid: number): Promise<boolean> {
          const result = await promisifyQuery(tenantId, insert_critical_value_alert, [billingid, testid, statement, employeeid]);
          return rowAffected(result);
     }
}