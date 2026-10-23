import { describe, expect, it } from 'vitest';
import { parseConfiguredTat } from './LabDeadlines';
describe('configured laboratory deadlines', () => {
     it.each([[30, 30], ['90', 90], ['1 day 2 hr 30 min', 1590], ['2hours', 120], [null, null], ['not set', null], [0, null], [-1, null]])('parses %s as %s minutes', (value, expected) => {
          expect(parseConfiguredTat(value)).toBe(expected);
     });
});
