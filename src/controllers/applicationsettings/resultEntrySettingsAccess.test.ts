import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock('../../LobnosAuth/user', () => ({
     default: class { getUserRole = mocks.role; },
}));
vi.mock('../../models/application/appsettings/result-settings/resultSettings', () => ({
     default: class {
          static getResultEntrySettings = mocks.getSettings;
          static updateResultEntrySettings = mocks.updateSettings;
     },
}));
vi.mock('../../models/application/appsettings/appset', () => ({ default: class {} }));
vi.mock('../../models/application/Tax', () => ({ default: class {} }));
vi.mock('../../database/TiifuWorkingClass', () => ({ TiifuWorkingClass: class {} }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn(), info: vi.fn() } }));
vi.mock('../../hooks/helper', () => ({ responseError: vi.fn(), customError: vi.fn() }));
vi.mock('../../models/application/appsettings/billingLayout', () => ({ isBillingLayout: vi.fn() }));
vi.mock('../../models/billing/multi/initCustomerBilling', () => ({ CustomerBillingInit: class {} }));
vi.mock('../../models/billing/billing-new-client-multi', () => ({ SubmitCustomerBilling: vi.fn() }));
vi.mock('../../models/billing/multi/customerBillingCheckout', () => ({ CustomerBillingCheckout: class {} }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: vi.fn() }));
vi.mock('../../database/interface', () => ({ categoryColumnMapper: {}, smsTemplatePlaceholdersOptions: {} }));

import { resultEntrySettingsHandler, resultEntrySettingsUpdateHandler } from './handler';
import { customError } from '../../hooks/helper';
import { getAuthUser } from '../../middleware/authority';

function response() {
     return { send: vi.fn() } as any;
}

beforeEach(() => {
     vi.clearAllMocks();
     mocks.role.mockResolvedValue('sonographer');
     vi.mocked(getAuthUser).mockReturnValue({ tenantId: 1, employeeid: 7, role: 'sonographer' } as any);
     mocks.getSettings.mockResolvedValue({ minimumResultValidation: 1, maximumResultValidation: 2 });
     mocks.updateSettings.mockResolvedValue(true);
});

describe('result-entry settings access', () => {
     it('allows sonographers to read the approval limits needed for ultrasound review', async () => {
          const res = response();
          await resultEntrySettingsHandler({ query: { tenantId: 1 } } as any, res);
          expect(res.send).toHaveBeenCalledWith({ result: { minimumResultValidation: 1, maximumResultValidation: 2 } });
          expect(mocks.getSettings).toHaveBeenCalledWith(1);
     });

     it('does not allow sonographers to change result-entry settings', async () => {
          const res = response();
          await resultEntrySettingsUpdateHandler({ query: { tenantId: 1 }, body: {} } as any, res);
          expect(customError).toHaveBeenCalledWith(expect.any(String), 403, res);
          expect(mocks.updateSettings).not.toHaveBeenCalled();
     });

     it('rejects settings access outside the authenticated tenant', async () => {
          const res = response();
          await resultEntrySettingsHandler({ query: { tenantId: 2 } } as any, res);
          expect(res.status).toBeUndefined();
          expect(mocks.getSettings).not.toHaveBeenCalled();
     });
});
