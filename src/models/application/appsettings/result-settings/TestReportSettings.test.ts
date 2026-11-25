import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     connection: vi.fn(),
     testSettings: vi.fn(),
     facilitySettings: vi.fn(),
}));

vi.mock('../../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('./resultSettings', () => ({
     default: class {
          getResultSettings = mocks.facilitySettings;
     },
}));

import TestReportSettings from './TestReportSettings';

describe('test report settings resolution', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          const query = { where: vi.fn().mockReturnThis(), first: mocks.testSettings };
          mocks.connection.mockResolvedValue(vi.fn(() => query));
          mocks.testSettings.mockResolvedValue({
               resultsettings: JSON.stringify({ companyInfo: { color: '#123456' } }),
          });
          mocks.facilitySettings.mockResolvedValue({
               fontfamily: 'Arial',
               companyInfo: { headerType: 'fullwidth', breakname: false, namefontsize: 28, color: '#000000' },
          });
     });

     it('inherits facility letterhead settings while allowing test-specific company styling', async () => {
          const settings = await TestReportSettings.resolve(42, 9001);
          expect(settings).toMatchObject({
               fontfamily: 'Arial',
               companyInfo: {
                    headerType: 'fullwidth',
                    breakname: false,
                    namefontsize: 28,
                    color: '#123456',
               },
          });
     });
});
