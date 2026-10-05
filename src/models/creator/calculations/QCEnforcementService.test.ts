import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectionMock, reviewResult } = vi.hoisted(() => ({
     connectionMock: vi.fn(),
     reviewResult: { value: null as any },
}));

vi.mock('../../../database/KnexConnections', () => ({ default: connectionMock }));

import { QCRequiredError, requireDailyQcAcceptance } from './QCEnforcementService';

function makeDatabase() {
     return ((table: string) => {
          const query: any = {
               select: () => query,
               where: () => query,
               whereRaw: () => query,
               innerJoin: () => query,
               whereIn: () => query,
               first: async () => table === 'test_panels' ? { requires_qc: 1 } : reviewResult.value,
          };
          return query;
     }) as any;
}

describe('daily QC result-entry enforcement', () => {
     beforeEach(() => {
          reviewResult.value = null;
          connectionMock.mockResolvedValue(makeDatabase());
     });

     it('blocks a QC-required test without a current accepted record', async () => {
          await expect(requireDailyQcAcceptance(1, 20)).rejects.toBeInstanceOf(QCRequiredError);
     });

     it('allows result entry when a same-day acceptance or bypass is recorded', async () => {
          reviewResult.value = { id: 1, decision: 'accepted' };
          await expect(requireDailyQcAcceptance(1, 20)).resolves.toBeUndefined();
     });
});