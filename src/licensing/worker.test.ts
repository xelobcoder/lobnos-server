import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ license: vi.fn(), module: vi.fn() }));
vi.mock('./enforcement', () => ({ requireOperationalLicense: mocks.license }));
vi.mock('../models/application/email/helpers/emailModuleActivation', () => ({ ensureEmailModuleActivated: mocks.module }));

import { EmailQueueService } from '../models/application/email/services/EmailQueueService';
import { LicenseError } from './certificate';

beforeEach(() => { vi.clearAllMocks(); mocks.module.mockResolvedValue(undefined); mocks.license.mockResolvedValue(undefined); });
describe('background email license entrypoints', () => {
     function build() {
          const queue = {
               getTenantId: () => 3,
               findProcessable: vi.fn().mockResolvedValue([]),
               findById: vi.fn().mockResolvedValue(undefined),
               update: vi.fn(),
          };
          const service = new EmailQueueService(queue as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
          return { service, queue };
     }
     it.each(['processQueue', 'processSingle'] as const)('checks license before %s reads/mutates jobs or consumes retries', async command => {
          mocks.license.mockRejectedValue(new LicenseError('LICENSE_EXPIRED'));
          const { service, queue } = build();
          await expect(service[command](1)).rejects.toMatchObject({ code: 'LICENSE_EXPIRED' });
          expect(mocks.license).toHaveBeenCalledWith(3);
          expect(queue.findProcessable).not.toHaveBeenCalled();
          expect(queue.findById).not.toHaveBeenCalled();
          expect(queue.update).not.toHaveBeenCalled();
          expect(mocks.module).not.toHaveBeenCalled();
     });
     it('retains the existing email-module activation requirement after licensing passes', async () => {
          const { service, queue } = build();
          mocks.module.mockRejectedValue(new Error('Email module is not activated.'));
          await expect(service.processQueue()).rejects.toThrow('Email module is not activated.');
          expect(mocks.license).toHaveBeenCalledWith(3);
          expect(mocks.module).toHaveBeenCalledWith(3);
          expect(queue.findProcessable).not.toHaveBeenCalled();
     });
     it('allows the unchanged queue path when license/module checks pass', async () => {
          const { service, queue } = build();
          expect(await service.processQueue(10)).toEqual([]);
          expect(queue.findProcessable).toHaveBeenCalledWith(10);
     });
});
