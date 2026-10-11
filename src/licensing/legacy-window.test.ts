import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// No connection or real environment is loaded; exercise the unchanged owning DB validity decision.
vi.mock('../database/KnexConnections', () => ({ default: vi.fn() }));
import PrimeWindowAccessRepository from '../models/settings/users/PrimeWindowAccessRepository';

const start = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-10-12T00:00:00.000Z');
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it.each([
     [true, '2026-09-30T23:59:59.999Z', false],
     [true, '2026-10-01T00:00:00.000Z', true],
     [true, '2026-10-12T00:00:00.000Z', true],
     [true, '2026-10-12T00:00:00.001Z', false],
     // Existing non-renewed windows deliberately authorize only end-to-grace, not start-to-end.
     [false, '2026-10-11T00:00:00.000Z', false],
     [false, '2026-10-12T00:00:00.000Z', true],
     [false, '2026-10-15T00:00:00.000Z', true],
     [false, '2026-10-15T00:00:00.001Z', false],
])('preserves renewed=%s DB window at %s as %s', async (renewed, now, valid) => {
     vi.setSystemTime(new Date(now));
     const repo = new PrimeWindowAccessRepository(3);
     vi.spyOn(repo, 'getCurrentWindow').mockResolvedValue({
          id: 1, start_period: start, end_period: end, window_days: 3,
          islicensedRenewed: renewed, loginDurationPerUser: 6,
     });
     expect(await repo.validateLicense()).toBe(valid);
});
it('retains invalid/missing existing-window behavior', async () => {
     const repo = new PrimeWindowAccessRepository(3);
     vi.spyOn(repo, 'getCurrentWindow').mockResolvedValue(null);
     expect(await repo.validateLicense()).toBe(false);
});
