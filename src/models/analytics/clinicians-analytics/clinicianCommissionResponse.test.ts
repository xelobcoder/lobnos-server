import { describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/helper', () => ({ promisifyQuery: query, paginationQuery: vi.fn() }));
vi.mock('../../clincians/clinicianClass', () => ({ default: class {} }));
import ClinicianAnalytics from './clinicians-analytics';

describe('clinician commission response', () => {
     it('returns an empty list after all eligible commissions have been batched', async () => {
          query.mockResolvedValueOnce([]);
          expect(await ClinicianAnalytics.getClinicianCommission(1, 2, '2026-01-01', '2026-11-13')).toEqual([]);
     });
});
