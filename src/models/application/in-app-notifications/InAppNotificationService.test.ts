import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     connection: vi.fn(),
     bootstrap: vi.fn(),
}));

vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('./InAppNotificationBootstrapper', () => ({
     bootstrapInAppNotificationTables: mocks.bootstrap,
}));

import { InAppNotificationService } from './InAppNotificationService';

describe('in-app notification schema initialization', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.bootstrap.mockResolvedValue(undefined);
          const query: any = {};
          for (const method of ['leftJoin', 'select', 'whereNull', 'orderByRaw', 'orderBy', 'limit', 'count']) {
               query[method] = vi.fn(() => query);
          }
          query.first = vi.fn().mockResolvedValue({ count: '0' });
          const connection: any = vi.fn(() => query);
          connection.raw = vi.fn();
          mocks.connection.mockResolvedValue(connection);
     });

     it('creates missing notification tables before querying and initializes only once per tenant', async () => {
          const tenantId = 987654;

          expect(await InAppNotificationService.getUnreadCount(tenantId, 58)).toBe(0);
          expect(await InAppNotificationService.getUnreadCount(tenantId, 58)).toBe(0);

          expect(mocks.bootstrap).toHaveBeenCalledOnce();
          expect(mocks.bootstrap).toHaveBeenCalledWith(tenantId);
     });
});
