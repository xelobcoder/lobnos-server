import { FacilityError } from './FacilityInput';
import {
     PERIOD_WINDOW, SubscriptionFrequency, addDays, exactPeriodIndex, periodAt, periodIndexOf, periodStartAt,
} from './FacilityManagementInput';

/**
 * Effective-dated subscription schedule. Each segment applies from its startDate until the day before the
 * next segment's startDate (the last segment is open-ended). Later segments must start on a period boundary
 * of the preceding segment, so no period is ever split, prorated or dropped by a plan change.
 */
export interface PlanSegment {
     planId: number;
     frequency: SubscriptionFrequency;
     amount: string;
     currency: string;
     startDate: string;
}
export interface SchedulePosition { segment: number; index: number; }
export interface SchedulePeriod {
     planId: number; frequency: SubscriptionFrequency; amount: string; currency: string;
     periodStart: string; periodEnd: string; dueDate: string;
}

export function segmentEndDate(segments: PlanSegment[], segment: number): string | null {
     const next = segments[segment + 1];
     return next ? addDays(next.startDate, -1) : null;
}

/** Last period index of a closed segment, or Infinity for the open-ended last segment. */
export function lastIndexOf(segments: PlanSegment[], segment: number): number {
     const end = segmentEndDate(segments, segment);
     const { frequency, startDate } = segments[segment];
     return end === null ? Number.POSITIVE_INFINITY : periodIndexOf(frequency, startDate, end);
}

export function segmentFor(segments: PlanSegment[], date: string): number {
     for (let i = segments.length - 1; i >= 0; i--) if (segments[i].startDate <= date) return i;
     return -1;
}

export function locate(segments: PlanSegment[], date: string): SchedulePosition | null {
     const segment = segmentFor(segments, date);
     if (segment < 0) return null;
     const { frequency, startDate } = segments[segment];
     return { segment, index: periodIndexOf(frequency, startDate, date) };
}

export function periodOf(segments: PlanSegment[], position: SchedulePosition): SchedulePeriod {
     const plan = segments[position.segment];
     const period = periodAt(plan.frequency, plan.startDate, position.index);
     return {
          planId: plan.planId, frequency: plan.frequency, amount: plan.amount, currency: plan.currency,
          periodStart: period.periodStart, periodEnd: period.periodEnd, dueDate: period.dueDate,
     };
}

export function nextPosition(segments: PlanSegment[], position: SchedulePosition): SchedulePosition | null {
     if (position.index < lastIndexOf(segments, position.segment)) return { segment: position.segment, index: position.index + 1 };
     return position.segment + 1 < segments.length ? { segment: position.segment + 1, index: 0 } : null;
}

export function previousPosition(segments: PlanSegment[], position: SchedulePosition): SchedulePosition | null {
     if (position.index > 0) return { segment: position.segment, index: position.index - 1 };
     if (position.segment === 0) return null;
     return { segment: position.segment - 1, index: lastIndexOf(segments, position.segment - 1) };
}

/** The schedule period starting exactly on periodStart, or null if periodStart is not a period boundary. */
export function exactPeriod(segments: PlanSegment[], periodStart: string): { position: SchedulePosition; period: SchedulePeriod } | null {
     const segment = segmentFor(segments, periodStart);
     if (segment < 0) return null;
     const { frequency, startDate } = segments[segment];
     const index = exactPeriodIndex(frequency, startDate, periodStart);
     if (index === null || index > lastIndexOf(segments, segment)) return null;
     const position = { segment, index };
     return { position, period: periodOf(segments, position) };
}

export interface ScheduleWindow {
     positions: SchedulePosition[];
     current: SchedulePosition | null;
     past: number;
     future: number;
     frequency: SubscriptionFrequency;
}

/** Current period plus up to `past` earlier and `future` later periods (sizes from the current segment's frequency). */
export function scheduleWindow(segments: PlanSegment[], asOf: string): ScheduleWindow {
     if (segments.length === 0) throw new Error('Schedule is empty');
     const current = locate(segments, asOf);
     const frequency = segments[current ? current.segment : 0].frequency;
     const { past, future } = PERIOD_WINDOW[frequency];
     if (!current) {
          const positions: SchedulePosition[] = [];
          let position: SchedulePosition | null = { segment: 0, index: 0 };
          while (position && positions.length < future) { positions.push(position); position = nextPosition(segments, position); }
          return { positions, current: null, past, future, frequency };
     }
     const before: SchedulePosition[] = [];
     let back = previousPosition(segments, current);
     while (back && before.length < past) { before.unshift(back); back = previousPosition(segments, back); }
     const after: SchedulePosition[] = [];
     let forward = nextPosition(segments, current);
     while (forward && after.length < future) { after.push(forward); forward = nextPosition(segments, forward); }
     return { positions: [...before, current, ...after], current, past, future, frequency };
}

/** Number of schedule periods whose periodStart is before `date` (computed arithmetically, not generated). */
export function countPeriodsBefore(segments: PlanSegment[], date: string): number {
     let count = 0;
     for (let segment = 0; segment < segments.length; segment++) {
          const { frequency, startDate } = segments[segment];
          if (startDate >= date) break;
          count += Math.min(periodIndexOf(frequency, startDate, addDays(date, -1)), lastIndexOf(segments, segment)) + 1;
     }
     return count;
}

/** Latest periodStart a payment may be recorded for: `future` periods after today's period (in advance). */
export function maxAdvancePeriodStart(segments: PlanSegment[], today: string): string {
     const current = locate(segments, today);
     let position: SchedulePosition = current || { segment: 0, index: 0 };
     const steps = PERIOD_WINDOW[segments[position.segment].frequency].future - (current ? 0 : 1);
     for (let i = 0; i < steps; i++) {
          const next = nextPosition(segments, position);
          if (!next) break;
          position = next;
     }
     return periodOf(segments, position).periodStart;
}

/** First period boundary of a segment on or after `date` (for actionable error messages). */
export function nextBoundary(segment: PlanSegment, date: string): string {
     const index = periodIndexOf(segment.frequency, segment.startDate, date);
     const start = periodStartAt(segment.frequency, segment.startDate, Math.max(index, 0));
     return start === date ? start : periodStartAt(segment.frequency, segment.startDate, index + 1);
}

export type PlanChange =
     | { mode: 'create' | 'append'; replaced: null; segments: PlanSegment[] }
     | { mode: 'replace'; replaced: PlanSegment; segments: PlanSegment[] };

/**
 * Plans the effect of PUT /subscription on the schedule:
 * - no plan: create the first segment (any valid startDate);
 * - startDate after the latest segment's start: schedule a change from that boundary (earlier periods,
 *   including unpaid/overdue ones, keep their original plan);
 * - startDate on/before the latest segment's start: correct (replace) the latest segment; it must still
 *   start after the previous segment, on its period boundary.
 * Returns null for an identical replacement (no-op).
 */
export function planScheduleChange(segments: PlanSegment[], next: Omit<PlanSegment, 'planId'>): PlanChange | null {
     const candidate: PlanSegment = { planId: 0, ...next };
     if (segments.length === 0) return { mode: 'create', replaced: null, segments: [candidate] };
     const latest = segments[segments.length - 1];
     let preceding: PlanSegment | undefined;
     let change: PlanChange;
     if (next.startDate > latest.startDate) {
          preceding = latest;
          change = { mode: 'append', replaced: null, segments: [...segments, candidate] };
     } else {
          if (next.startDate === latest.startDate && next.frequency === latest.frequency
               && next.amount === latest.amount && next.currency === latest.currency) return null;
          preceding = segments[segments.length - 2];
          if (preceding && next.startDate <= preceding.startDate) {
               throw new FacilityError(`startDate must be after ${preceding.startDate}, the start of the previous plan segment; earlier segments cannot be rewritten`, 409);
          }
          change = { mode: 'replace', replaced: latest, segments: [...segments.slice(0, -1), candidate] };
     }
     if (preceding && exactPeriodIndex(preceding.frequency, preceding.startDate, next.startDate) === null) {
          throw new FacilityError(`startDate must be a ${preceding.frequency} period boundary of the preceding plan (next boundary: ${nextBoundary(preceding, next.startDate)})`);
     }
     return change;
}