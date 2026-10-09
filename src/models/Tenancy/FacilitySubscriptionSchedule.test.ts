import { describe, expect, it } from 'vitest';
import {
     PlanSegment, countPeriodsBefore, exactPeriod, maxAdvancePeriodStart, periodOf, planScheduleChange, scheduleWindow,
} from './FacilitySubscriptionSchedule';
import { FacilityError } from './FacilityInput';

const monthly: PlanSegment = { planId: 1, frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' };
const yearly: PlanSegment = { planId: 2, frequency: 'yearly', amount: '1500.00', currency: 'GHS', startDate: '2026-12-31' };

describe('effective-dated subscription schedule', () => {
     it('keeps earlier periods of the previous plan when a change is scheduled', () => {
          const change = planScheduleChange([monthly], { frequency: 'yearly', amount: '1500.00', currency: 'GHS', startDate: '2026-12-31' })!;
          expect(change.mode).toBe('append');
          const segments = [monthly, yearly];
          expect(exactPeriod(segments, '2026-11-30')!.period).toMatchObject({ planId: 1, periodEnd: '2026-12-30', amount: '150.00' });
          expect(exactPeriod(segments, '2026-12-31')!.period).toMatchObject({ planId: 2, periodEnd: '2027-12-30', amount: '1500.00' });
          expect(exactPeriod(segments, '2027-01-31')).toBeNull();
          expect(countPeriodsBefore(segments, '2027-12-31')).toBe(12);
     });
     it('requires a scheduled change to start on a boundary of the preceding plan', () => {
          expect(() => planScheduleChange([monthly], { ...yearly, startDate: '2026-12-01' })).toThrow(/next boundary: 2026-12-31/);
     });
     it('replaces only the latest segment and never rewrites earlier ones', () => {
          expect(planScheduleChange([monthly], { frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' })).toBeNull();
          expect(planScheduleChange([monthly], { frequency: 'monthly', amount: '175.00', currency: 'GHS', startDate: '2026-01-31' })!.mode).toBe('replace');
          expect(planScheduleChange([monthly], { frequency: 'weekly', amount: '40.00', currency: 'GHS', startDate: '2025-06-01' })!.mode).toBe('replace');
          const segments = [monthly, yearly];
          expect(planScheduleChange(segments, { ...yearly, amount: '1600.00' })!.mode).toBe('replace');
          expect(() => planScheduleChange(segments, { ...yearly, startDate: '2026-01-31' })).toThrow(FacilityError);
          expect(() => planScheduleChange(segments, { ...yearly, startDate: '2026-06-15' })).toThrow(/boundary/);
     });
     it('builds a bounded window across segments', () => {
          const window = scheduleWindow([monthly, yearly], '2027-03-01');
          expect(window.frequency).toBe('yearly');
          expect(window.positions.map(p => periodOf([monthly, yearly], p).periodStart))
               .toEqual(['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-12-31']);
          const before = scheduleWindow([monthly], '2025-01-01');
          expect(before.current).toBeNull();
          expect(before.positions).toHaveLength(3);
     });
     it('limits advance payments from the current period', () => {
          expect(maxAdvancePeriodStart([monthly], '2026-10-09')).toBe('2026-12-31');
          expect(maxAdvancePeriodStart([monthly, yearly], '2026-10-09')).toBe('2026-12-31');
          expect(maxAdvancePeriodStart([monthly], '2025-10-09')).toBe('2026-03-31');
     });
});