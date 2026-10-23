import { describe, expect, it } from 'vitest';
import { performancePeriods, referralChange } from './ReferralPerformance';
describe('referral performance comparisons', () => {
     it('compares month-to-date with an equal preceding period', () => {
          expect(performancePeriods({ start: '2026-10-01', end: '2026-10-23' })).toMatchObject({ previousStart: '2026-09-08', previousEnd: '2026-09-30' });
     });
     it('clamps previous month and year dates correctly at month ends and leap days', () => {
          expect(performancePeriods({ start: '2026-03-01', end: '2026-03-31', comparison: 'previous_month' })).toMatchObject({ previousStart: '2026-02-01', previousEnd: '2026-02-28' });
          expect(performancePeriods({ start: '2024-02-29', end: '2024-02-29', comparison: 'previous_year' }).previousStart).toBe('2023-02-28');
     });
     it('supports weekly and custom comparisons and rejects invalid calendar dates and reversed ranges', () => {
          expect(performancePeriods({ start: '2026-10-19', end: '2026-10-23', comparison: 'previous_week' }).previousStart).toBe('2026-10-12');
          expect(performancePeriods({ start: '2026-10-01', end: '2026-10-23', comparison: 'custom', previous_start: '2026-01-01', previous_end: '2026-01-23' }).previousEnd).toBe('2026-01-23');
          expect(() => performancePeriods({ start: '2026-02-30', end: '2026-03-01' })).toThrow();
          expect(() => performancePeriods({ start: '2026-10-23', end: '2026-10-01' })).toThrow();
     });
     it('reports new activity without inventing an infinite percentage', () => {
          expect(referralChange(5, 0)).toEqual({ absolute: 5, percent: null, new_activity: true });
          expect(referralChange(0, 10).percent).toBe(-100);
          expect(referralChange(15, 10).percent).toBe(50);
     });
});
