import { describe, expect, it } from 'vitest';
import {
     evaluateConditionRuleAgainstValue,
     normalizeConstraintType,
     normalizeParameterName,
     parseBetweenRange,
} from '../criticalValueAnalyzer';

describe('criticalValueAnalyzer', () => {
     it('normalizes constraint operators onto logging enum values', () => {
          expect(normalizeConstraintType('greater than')).toBe('greater');
          expect(normalizeConstraintType('less than')).toBe('less');
          expect(normalizeConstraintType('equal to')).toBe('match');
          expect(normalizeConstraintType('not match')).toBe('notmatch');
          expect(normalizeConstraintType('contains')).toBe('contains');
          expect(normalizeConstraintType('between')).toBe('between');
     });

     it('normalizes the real UI operator phrasing like "Greater than value"', () => {
          expect(normalizeConstraintType('Greater than value')).toBe('greater');
          expect(normalizeConstraintType('Less than value')).toBe('less');
          expect(normalizeConstraintType('Equal to value')).toBe('match');
          expect(normalizeConstraintType('Contains value')).toBe('contains');
     });

     it('hits a stored "Greater than value" rule against a big submitted value', () => {
          const rule = {
               id: 46,
               testId: 100103,
               parameter: 'PARASITE COUNT',
               conditionId: 2,
               target: '100',
               inRange: 0,
               conditionConstraint: 'Greater than value',
               conditionName: 'PARASITE COUNT ',
          };

          expect(evaluateConditionRuleAgainstValue(rule as any, '50000')).toBe(true);
          expect(evaluateConditionRuleAgainstValue(rule as any, '50')).toBe(false);
     });

     it('normalizes parameter names for matching', () => {
          expect(normalizeParameterName('Parasite Count')).toBe('parasite count');
          expect(normalizeParameterName('  WBC  ')).toBe('wbc');
     });

     it('parses between ranges without treating the separator as a negative max', () => {
          expect(parseBetweenRange('70-100')).toEqual({ min: 70, max: 100 });
          expect(parseBetweenRange('70 to 100')).toEqual({ min: 70, max: 100 });
     });

     it('flags values that violate greater-than rules', () => {
          const rule = {
               id: 1,
               testId: 10,
               parameter: 'parasite count',
               conditionId: 3,
               target: '100',
               inRange: 0,
               conditionConstraint: 'greater than',
               conditionName: 'High parasite count',
          };

          expect(evaluateConditionRuleAgainstValue(rule as any, '5000')).toBe(true);
          expect(evaluateConditionRuleAgainstValue(rule as any, '50')).toBe(false);
     });

     it('flags values inside between ranges when inRange=1', () => {
          const rule = {
               id: 2,
               testId: 10,
               parameter: 'glucose',
               conditionId: 4,
               target: '70-100',
               inRange: 1,
               conditionConstraint: 'between',
               conditionName: 'Glucose range',
          };

          expect(evaluateConditionRuleAgainstValue(rule as any, '60')).toBe(false);
          expect(evaluateConditionRuleAgainstValue(rule as any, '80')).toBe(true);
          expect(evaluateConditionRuleAgainstValue(rule as any, '110')).toBe(false);
     });

     it('flags values outside between ranges when inRange=0', () => {
          const rule = {
               id: 3,
               testId: 10,
               parameter: 'glucose',
               conditionId: 4,
               target: '70-100',
               inRange: 0,
               conditionConstraint: 'between',
               conditionName: 'Glucose out of range',
          };

          expect(evaluateConditionRuleAgainstValue(rule as any, '60')).toBe(true);
          expect(evaluateConditionRuleAgainstValue(rule as any, '80')).toBe(false);
          expect(evaluateConditionRuleAgainstValue(rule as any, '110')).toBe(true);
     });
});
