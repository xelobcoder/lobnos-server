import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../../../database/KnexConnections', () => ({ default: mocks.connection }));

import { bootstrapTestReportSettingsTable } from './TestReportSettingsBootstrapper';

describe('test report settings table bootstrap', () => {
     beforeEach(() => vi.clearAllMocks());

     it('creates test_report_settings when it is missing from the facility database', async () => {
          const db = {
               schema: {
                    hasTable: vi.fn().mockResolvedValue(false),
                    createTable: vi.fn(),
               },
               fn: { now: vi.fn() },
          };
          mocks.connection.mockResolvedValue(db);

          await bootstrapTestReportSettingsTable(42);

          expect(mocks.connection).toHaveBeenCalledWith(42);
          expect(db.schema.createTable).toHaveBeenCalledWith('test_report_settings', expect.any(Function));
     });

     it('does not recreate an existing table', async () => {
          const db = {
               schema: {
                    hasTable: vi.fn().mockResolvedValue(true),
                    createTable: vi.fn(),
               },
               fn: { now: vi.fn() },
          };
          mocks.connection.mockResolvedValue(db);

          await bootstrapTestReportSettingsTable(42);

          expect(db.schema.createTable).not.toHaveBeenCalled();
     });
});
