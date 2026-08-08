import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnseenPaginated = vi.fn();

vi.mock('../../../models/creator/Repo/loggingCriticalValueAlertRepository', () => ({
     default: vi.fn().mockImplementation(() => ({
          findUnseenPaginated
     }))
}));

vi.mock('../../../models/application/appsettings/result-settings/resultSettings', () => ({
     default: {},
     ApplicationResultSettings: {}
}));

vi.mock('../../../models/settings/companyProfile', () => ({
     companyInfo: vi.fn(),
     getAllCompanyProfiles: vi.fn()
}));

vi.mock('../../../models/registration/registration', () => ({
     default: class { }
}));

vi.mock('../../../models/creator/resultEncryptionReferer', () => ({
     default: vi.fn()
}));

vi.mock('../../../models/creator/creator', () => ({
     default: class { }
}));

vi.mock('../../../models/TestCreation/TestCreationRulesRepository', () => ({
     default: class { }
}));

vi.mock('../../../models/security/RequestAcessResult/requestAcess', () => ({
     default: { verifyWindowPeriod: vi.fn() }
}));

vi.mock('../../../models/services/services', () => ({
     Services: class { }
}));

vi.mock('../../../database/KnexConnections', () => ({
     default: vi.fn()
}));

vi.mock('../../../models/application/notifications/services/NotificationDispatcher', () => ({
     NotificationDispatcher: { dispatch: vi.fn() }
}));

vi.mock('../../../hooks/helper', () => ({
     customError: vi.fn(),
     responseError: vi.fn()
}));

import { criticalValuesUnseenHandler } from '../resultHandlers';

describe('criticalValuesUnseenHandler', () => {
     beforeEach(() => {
          findUnseenPaginated.mockReset();
     });

     it('returns paginated unseen critical alerts for the tenant', async () => {
          findUnseenPaginated.mockResolvedValue({
               data: [{ crkeyId: 1, statement: 'High value' }],
               total: 1,
               page: 2,
               pageSize: 5
          });

          const req = {
               query: {
                    tenantId: '2',
                    count: '5',
                    page: '2'
               }
          } as any;

          const res = {
               send: vi.fn(),
               status: vi.fn().mockReturnThis()
          } as any;

          await criticalValuesUnseenHandler(req, res);

          expect(findUnseenPaginated).toHaveBeenCalledWith(2, 5, 'DESC');
          expect(res.send).toHaveBeenCalledWith({
               data: [{ crkeyId: 1, statement: 'High value' }],
               total: 1,
               page: 2,
               pageSize: 5
          });
     });
});
