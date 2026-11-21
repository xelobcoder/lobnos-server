import { describe, expect, it } from 'vitest';
import { parseConfiguredTat,analyticTatMetrics } from './LabDeadlines';
describe('configured laboratory deadlines', () => {
     it.each([[30, 30], ['90', 90], ['1 day 2 hr 30 min', 1590], ['2hours', 120], [null, null], ['not set', null], [0, null], [-1, null]])('parses %s as %s minutes', (value, expected) => {
          expect(parseConfiguredTat(value)).toBe(expected);
     });
});

it('converts legacy numeric units without confusing hours with minutes',()=>{expect(parseConfiguredTat(2,'hour')).toBe(120);expect(parseConfiguredTat(2,'days')).toBe(2880);expect(parseConfiguredTat(90,'seconds')).toBe(2);});
it('analytical timing uses processing timestamps and never fabricates zero for a bypassed stage',()=>{expect(analyticTatMetrics({tat:1,tatEvaluation:'hour',processingStartDate:'2026-11-21T00:00:00Z',processingEndDate:'2026-11-21T01:01:00Z'})).toMatchObject({analyticTatMinutes:60,actualAnalyticTatMinutes:61,analyticTatExceeded:true,analyticTatExceededBy:1});expect(analyticTatMetrics({tat:30,processingDuration:0,turnaroundtime:300})).toMatchObject({actualAnalyticTatMinutes:null,analyticTatExceeded:null});});
