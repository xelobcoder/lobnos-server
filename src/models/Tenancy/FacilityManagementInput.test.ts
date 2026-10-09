import { describe, expect, it } from 'vitest';
import {
     exactPeriodIndex, formatCents, parseAuditQuery, normalizeStoredAmount, parseAmountToCents, parseAsOf, parseIsoDate, parsePaymentIdParam,
     parseTenantIdParam, periodAt, periodIndexOf, storedDateToIso, validatePaymentInput, validateStatusChange,
     validateSubscriptionPlan, validateVoidInput,
} from './FacilityManagementInput';
import { FacilityError } from './FacilityInput';

const starts = (frequency: any, anchor: string, n: number) => Array.from({ length: n }, (_, i) => periodAt(frequency, anchor, i));

describe('subscription calendar arithmetic', () => {
     it('anchors monthly periods on Jan 31 without drifting (leap and non-leap)', () => {
          expect(starts('monthly', '2024-01-31', 5).map(p => [p.periodStart, p.periodEnd])).toEqual([
               ['2024-01-31', '2024-02-28'], ['2024-02-29', '2024-03-30'], ['2024-03-31', '2024-04-29'],
               ['2024-04-30', '2024-05-30'], ['2024-05-31', '2024-06-29'],
          ]);
          expect(periodAt('monthly', '2025-01-31', 1)).toMatchObject({ periodStart: '2025-02-28', periodEnd: '2025-03-30' });
          expect(periodAt('monthly', '2025-12-15', 1)).toMatchObject({ periodStart: '2026-01-15', periodEnd: '2026-02-14' });
     });
     it('anchors yearly periods on Feb 29 and returns to Feb 29 in leap years', () => {
          expect(starts('yearly', '2024-02-29', 5).map(p => p.periodStart))
               .toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
          expect(periodAt('yearly', '2024-02-29', 0).periodEnd).toBe('2025-02-27');
          expect(periodAt('yearly', '2027-02-28', 0).periodEnd).toBe('2028-02-27');
     });
     it('uses inclusive ends and dueDate = periodStart for daily and weekly periods', () => {
          expect(periodAt('daily', '2024-02-28', 1)).toEqual({ index: 1, periodStart: '2024-02-29', periodEnd: '2024-02-29', dueDate: '2024-02-29' });
          expect(periodAt('weekly', '2024-12-30', 0)).toMatchObject({ periodStart: '2024-12-30', periodEnd: '2025-01-05', dueDate: '2024-12-30' });
     });
     it('locates the period containing a date and exact boundaries', () => {
          expect(periodIndexOf('monthly', '2024-01-31', '2024-01-30')).toBe(-1);
          expect(periodIndexOf('monthly', '2024-01-31', '2024-02-28')).toBe(0);
          expect(periodIndexOf('monthly', '2024-01-31', '2024-02-29')).toBe(1);
          expect(periodIndexOf('yearly', '2024-02-29', '2025-02-27')).toBe(0);
          expect(periodIndexOf('yearly', '2024-02-29', '2025-02-28')).toBe(1);
          expect(periodIndexOf('weekly', '2024-01-01', '2024-01-14')).toBe(1);
          expect(periodIndexOf('daily', '2020-01-01', '2026-10-09')).toBe(2473);
          expect(exactPeriodIndex('monthly', '2024-01-31', '2024-03-31')).toBe(2);
          expect(exactPeriodIndex('monthly', '2024-01-31', '2024-03-30')).toBeNull();
     });
     it('every generated monthly/yearly period is contiguous over a long range', () => {
          for (const [frequency, anchor] of [['monthly', '2023-01-31'], ['monthly', '2024-02-29'], ['yearly', '2024-02-29']] as const) {
               const periods = starts(frequency, anchor, 60);
               for (let i = 1; i < periods.length; i++) {
                    const previousEnd = new Date(periods[i - 1].periodEnd + 'T00:00:00Z').getTime();
                    expect(new Date(periods[i].periodStart + 'T00:00:00Z').getTime() - previousEnd).toBe(86_400_000);
                    expect(periodIndexOf(frequency, anchor, periods[i].periodStart)).toBe(i);
                    expect(periodIndexOf(frequency, anchor, periods[i].periodEnd)).toBe(i);
               }
          }
     });
});

describe('money as exact decimal strings', () => {
     it('accepts up to 10 integer digits and 2 decimals and normalizes to 2dp', () => {
          expect(formatCents(parseAmountToCents('150'))).toBe('150.00');
          expect(formatCents(parseAmountToCents('0.1'))).toBe('0.10');
          expect(formatCents(parseAmountToCents('9999999999.99'))).toBe('9999999999.99');
          expect(normalizeStoredAmount('150.5')).toBe('150.50');
          expect(normalizeStoredAmount('150.5000')).toBe('150.50');
     });
     it.each([150, '0', '0.00', '-1', '1.234', '01', '1e3', ' 1', '1.', '.5', '10000000000', '', null])('rejects %j', value => {
          expect(() => parseAmountToCents(value)).toThrow(FacilityError);
     });
});

describe('request validation', () => {
     it('validates dates strictly', () => {
          expect(parseIsoDate('2024-02-29', 'd')).toBe('2024-02-29');
          for (const bad of ['2023-02-29', '2024-13-01', '2024-1-01', '1999-12-31', '2101-01-01', 20240229, '2024-02-29T00:00:00Z']) {
               expect(() => parseIsoDate(bad, 'd')).toThrow(FacilityError);
          }
          expect(parseAsOf(undefined, '2026-10-09')).toBe('2026-10-09');
          expect(() => parseAsOf(['2026-01-01'], '2026-10-09')).toThrow(FacilityError);
          expect(storedDateToIso(new Date(2024, 1, 29))).toBe('2024-02-29');
     });
     it('validates route params', () => {
          expect(parseTenantIdParam('654321')).toBe(654321);
          for (const bad of ['12345', '0654321', '1234567', 'abc', undefined]) expect(() => parseTenantIdParam(bad)).toThrow(FacilityError);
          expect(parsePaymentIdParam('7')).toBe(7);
          for (const bad of ['0', '-1', '1.5', 'x']) expect(() => parsePaymentIdParam(bad)).toThrow(FacilityError);
     });
     it('validates status changes', () => {
          expect(validateStatusChange({ status: 'suspended', reason: '  unpaid  ' })).toEqual({ status: 'suspended', reason: 'unpaid' });
          for (const bad of [{ status: 'failed', reason: 'xxx' }, { status: 'ACTIVE', reason: 'xxx' }, { status: 'active' },
               { status: 'active', reason: '  ab ' }, { status: 'active', reason: 'x'.repeat(501) }, null, []]) {
               expect(() => validateStatusChange(bad)).toThrow(FacilityError);
          }
     });
     it('validates plans', () => {
          expect(validateSubscriptionPlan({ frequency: 'monthly', amount: '150', currency: 'GHS', startDate: '2026-01-31' }))
               .toEqual({ frequency: 'monthly', amountCents: 15000, currency: 'GHS', startDate: '2026-01-31' });
          for (const bad of [
               { frequency: 'quarterly', amount: '1', currency: 'GHS', startDate: '2026-01-01' },
               { frequency: 'monthly', amount: 1, currency: 'GHS', startDate: '2026-01-01' },
               { frequency: 'monthly', amount: '1', currency: 'ghs', startDate: '2026-01-01' },
               { frequency: 'monthly', amount: '1', currency: 'GHSX', startDate: '2026-01-01' },
               { frequency: 'monthly', amount: '1', currency: 'GHS', startDate: '2026-02-30' },
          ]) expect(() => validateSubscriptionPlan(bad)).toThrow(FacilityError);
     });
     it('validates payments and voids', () => {
          const ok = validatePaymentInput({ periodStart: '2026-09-30', paidAt: '2026-10-10', reference: ' R1 ', notes: '' }, '2026-10-09');
          expect(ok).toEqual({ periodStart: '2026-09-30', paidAt: '2026-10-10', reference: 'R1', notes: '' });
          expect(validatePaymentInput({ periodStart: '2026-09-30', paidAt: '2026-10-09', reference: 'R' }, '2026-10-09').notes).toBe('');
          for (const bad of [
               { periodStart: '2026-09-30', paidAt: '2026-10-11', reference: 'R', notes: '' },
               { periodStart: '2026-09-30', paidAt: '2026-10-09', reference: ' ', notes: '' },
               { periodStart: '2026-09-30', paidAt: '2026-10-09', reference: 'R'.repeat(101), notes: '' },
               { periodStart: '2026-09-30', paidAt: '2026-10-09', reference: 'R', notes: 'n'.repeat(501) },
               { periodStart: 'x', paidAt: '2026-10-09', reference: 'R', notes: '' },
          ]) expect(() => validatePaymentInput(bad, '2026-10-09')).toThrow(FacilityError);
          expect(validateVoidInput({ reason: ' duplicate entry ' })).toEqual({ reason: 'duplicate entry' });
          for (const bad of [{}, { reason: 'no' }, { reason: 'x'.repeat(501) }, null]) expect(() => validateVoidInput(bad)).toThrow(FacilityError);
     });
});

describe('audit query', () => {
     it('defaults and accepts 1..100 page sizes', () => {
          expect(parseAuditQuery({})).toEqual({ page: 1, pageSize: 25 });
          expect(parseAuditQuery(undefined)).toEqual({ page: 1, pageSize: 25 });
          expect(parseAuditQuery({ page: '3', pageSize: '100', tenantId: '990556' })).toEqual({ page: 3, pageSize: 100 });
          expect(parseAuditQuery({ pageSize: '1' })).toEqual({ page: 1, pageSize: 1 });
     });
     it.each([
          { pageSize: '101' }, { pageSize: '0' }, { pageSize: '-1' }, { pageSize: '1e2' }, { pageSize: '05' }, { page: '0' },
          { page: '100001' }, { page: ['1'] }, { page: { $gt: 1 } }, { page: 2 }, { order: 'asc' }, { 'pageSize ': '5' },
     ])('rejects %j', query => {
          expect(() => parseAuditQuery(query)).toThrow(FacilityError);
     });
});
