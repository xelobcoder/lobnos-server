import { describe, expect, it } from 'vitest';
import { computeDelta, parseNumericResult, pickDeltaRule, ruleExceeded, DeltaRule } from './ResultDeltaService';

const baseRule = (overrides: Partial<DeltaRule>): DeltaRule => ({
     id: 1,
     testid: 0,
     fieldid: 0,
     window_hours: 720,
     max_absolute: null,
     max_percent: null,
     action: 'warn',
     active: true,
     ...overrides,
});

describe('result delta checks', () => {
     it('reads the numeric part of a stored result', () => {
          expect(parseNumericResult('7.2 mg/dL')).toBe(7.2);
          expect(parseNumericResult('  116 ')).toBe(116);
          expect(parseNumericResult('1e3')).toBe(1000);
          expect(parseNumericResult('negative')).toBeNull();
          expect(parseNumericResult(null)).toBeNull();
     });

     it('computes absolute and percentage change', () => {
          expect(computeDelta(120, 100)).toEqual({ absolute: 20, percent: 20 });
          expect(computeDelta(80, 100)).toEqual({ absolute: 20, percent: 20 });
          expect(computeDelta(20, 0).percent).toBeNull();
     });

     it('prefers a field rule over a test rule over a global rule', () => {
          const rules = [
               baseRule({ id: 1, testid: 0, fieldid: 0 }),
               baseRule({ id: 2, testid: 10, fieldid: 0 }),
               baseRule({ id: 3, testid: 10, fieldid: 20 }),
               baseRule({ id: 4, testid: 11, fieldid: 20 }),
          ];
          expect(pickDeltaRule(rules, 10, 20)?.id).toBe(3);
          expect(pickDeltaRule(rules, 10, 21)?.id).toBe(2);
          expect(pickDeltaRule(rules, 12, 21)?.id).toBe(1);
     });

     it('ignores inactive rules', () => {
          expect(pickDeltaRule([baseRule({ active: false })], 10, 20)).toBeNull();
     });

     it('triggers when either the absolute or percentage limit is exceeded', () => {
          const absolute = baseRule({ max_absolute: 10 });
          const percent = baseRule({ max_percent: 15 });
          expect(ruleExceeded(absolute, { absolute: 11, percent: 5 })).toBe(true);
          expect(ruleExceeded(absolute, { absolute: 9, percent: 50 })).toBe(false);
          expect(ruleExceeded(percent, { absolute: 1, percent: 16 })).toBe(true);
          expect(ruleExceeded(percent, { absolute: 100, percent: 10 })).toBe(false);
          expect(ruleExceeded(baseRule({}), { absolute: 999, percent: 999 })).toBe(false);
     });

     it('sorts the most specific rule first even when input order differs', () => {
          const rules = [baseRule({ id: 9, testid: 10, fieldid: 20 }), baseRule({ id: 8, testid: 0, fieldid: 0 })];
          expect(pickDeltaRule(rules, 10, 20)?.id).toBe(9);
     });
});
