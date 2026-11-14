import { decrypt_value, encrypt_value } from '../../utils/encryptionModels';

export interface DeltaRule {
     id: number;
     testid: number;
     fieldid: number;
     window_hours: number;
     max_absolute: number | null;
     max_percent: number | null;
     action: 'warn' | 'block';
     active: boolean;
}

export interface DeltaViolation {
     fieldid: number;
     parameter: string;
     previousValue: number;
     currentValue: number;
     deltaAbsolute: number;
     deltaPercent: number | null;
     ruleId: number;
     action: 'warn' | 'block';
     maxAbsolute: number | null;
     maxPercent: number | null;
}

export interface DeltaEvaluation {
     violations: DeltaViolation[];
     blocking: DeltaViolation[];
}

/** Numeric part of a stored result. Units and free text are ignored. */
export function parseNumericResult(value: unknown): number | null {
     if (value === null || value === undefined) return null;
     const match = String(value).trim().match(/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/);
     if (!match) return null;
     const parsed = Number(match[0]);
     return Number.isFinite(parsed) ? parsed : null;
}

function safeDecrypt(value: unknown): string {
     const text = value === null || value === undefined ? '' : String(value);
     if (!text) return '';
     try {
          return decrypt_value(text);
     } catch {
          return text;
     }
}

export function computeDelta(current: number, previous: number): { absolute: number; percent: number | null } {
     const absolute = Math.abs(current - previous);
     const percent = previous === 0 ? null : (absolute / Math.abs(previous)) * 100;
     return { absolute, percent };
}

/** Most specific active rule wins: field+test, then test, then global. */
export function pickDeltaRule(rules: DeltaRule[], testid: number, fieldid: number): DeltaRule | null {
     const matching = rules.filter((rule) => (rule.active === true || Number(rule.active) === 1) &&
          (Number(rule.testid) === 0 || Number(rule.testid) === Number(testid)) &&
          (Number(rule.fieldid) === 0 || Number(rule.fieldid) === Number(fieldid)));
     if (!matching.length) return null;
     const specificity = (rule: DeltaRule) => (Number(rule.fieldid) > 0 ? 2 : 0) + (Number(rule.testid) > 0 ? 1 : 0);
     return matching.sort((a, b) => specificity(b) - specificity(a))[0];
}

export function ruleExceeded(rule: DeltaRule, delta: { absolute: number; percent: number | null }): boolean {
     const absolute = rule.max_absolute === null || rule.max_absolute === undefined ? null : Number(rule.max_absolute);
     const percent = rule.max_percent === null || rule.max_percent === undefined ? null : Number(rule.max_percent);
     if (absolute === null && percent === null) return false;
     if (absolute !== null && Number.isFinite(absolute) && delta.absolute > absolute) return true;
     if (percent !== null && Number.isFinite(percent) && delta.percent !== null && delta.percent > percent) return true;
     return false;
}

export interface DeltaContext {
     tenantId: number;
     ascensionid: number;
     testid: number;
     patientid: number;
}

/**
 * Compares each numeric parameter with the most recent prior result for the same patient, test
 * and parameter inside the configured window. Runs inside the approval transaction.
 */
export async function evaluateResultDeltas(trx: any, context: DeltaContext): Promise<DeltaEvaluation> {
     const rules = (await trx('pls_delta_rules').where({ active: true })) as DeltaRule[];
     if (!rules.length) return { violations: [], blocking: [] };

     const ascension = await trx('test_ascension').where({ id: context.ascensionid }).first('resultEntryEnd');
     const currentAt = ascension?.resultEntryEnd ? new Date(ascension.resultEntryEnd) : new Date();
     const currentRows = await trx('test_results')
          .where({ ascensionid: context.ascensionid, testid: context.testid })
          .select('fieldid', 'field', 'value');
     const violations: DeltaViolation[] = [];

     for (const row of currentRows as any[]) {
          const rule = pickDeltaRule(rules, Number(context.testid), Number(row.fieldid));
          if (!rule) continue;
          const currentValue = parseNumericResult(safeDecrypt(row.value));
          if (currentValue === null) continue;

          const windowStart = new Date(currentAt.getTime() - Number(rule.window_hours || 720) * 60 * 60 * 1000);
          const prior = await trx('test_results as result')
               .join('test_ascension as ascension', 'ascension.id', 'result.ascensionid')
               .where('result.patientid', context.patientid)
               .where('result.testid', context.testid)
               .where('result.fieldid', row.fieldid)
               .whereNot('result.ascensionid', context.ascensionid)
               .whereNotNull('ascension.resultEntryEnd')
               .where('ascension.resultEntryEnd', '<=', currentAt)
               .where('ascension.resultEntryEnd', '>=', windowStart)
               .orderBy('ascension.resultEntryEnd', 'desc')
               .select('result.value')
               .first();
          if (!prior) continue;
          const previousValue = parseNumericResult(safeDecrypt(prior.value));
          if (previousValue === null) continue;

          const delta = computeDelta(currentValue, previousValue);
          if (!ruleExceeded(rule, delta)) continue;
          violations.push({
               fieldid: Number(row.fieldid),
               parameter: String(row.field || ''),
               previousValue,
               currentValue,
               deltaAbsolute: delta.absolute,
               deltaPercent: delta.percent,
               ruleId: Number(rule.id),
               action: rule.action,
               maxAbsolute: rule.max_absolute === null ? null : Number(rule.max_absolute),
               maxPercent: rule.max_percent === null ? null : Number(rule.max_percent),
          });
     }

     return { violations, blocking: violations.filter((violation) => violation.action === 'block') };
}

/** Writes one audit event per ascension/field/rule and records a later acknowledgement. */
export async function recordDeltaEvents(
     trx: any,
     context: Pick<DeltaContext, 'ascensionid' | 'testid' | 'patientid'>,
     violations: DeltaViolation[],
     employeeid: number,
     reason?: string | null,
) {
     for (const violation of violations) {
          const existing = await trx('pls_result_safety_events')
               .where({ ascensionid: context.ascensionid, fieldid: violation.fieldid, rule_id: violation.ruleId })
               .first();
          if (existing) {
               if (reason && !existing.acknowledged_by) {
                    await trx('pls_result_safety_events').where({ id: existing.id }).update({
                         acknowledged_by: employeeid,
                         acknowledgement_reason: reason,
                    });
               }
               continue;
          }
          await trx('pls_result_safety_events').insert({
               ascensionid: context.ascensionid,
               testid: context.testid,
               fieldid: violation.fieldid,
               patientid: context.patientid,
               previous_value: encrypt_value(String(violation.previousValue)),
               current_value: encrypt_value(String(violation.currentValue)),
               delta_absolute: violation.deltaAbsolute,
               delta_percent: violation.deltaPercent,
               rule_id: violation.ruleId,
               action: violation.action,
               acknowledged_by: reason ? employeeid : null,
               acknowledgement_reason: reason || null,
          });
     }
}

export class DeltaCheckBlockedError extends Error {
     readonly statusCode = 409;
     readonly code = 'DELTA_CHECK_BLOCKED';
     constructor(readonly violations: DeltaViolation[]) {
          const labels = violations.map((violation) => `${violation.parameter || `parameter ${violation.fieldid}`}: ${violation.previousValue} → ${violation.currentValue}`).join('; ');
          super(`Delta check failed and a supervisor acknowledgement is required. ${labels}`);
          this.name = 'DeltaCheckBlockedError';
     }
}
