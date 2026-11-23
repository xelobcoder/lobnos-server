import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../../testSupport/accountingSqlDatabase';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), query: vi.fn(), bootstrap: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../../hooks/helper', () => ({ promisifyQuery: mocks.query, rowAffected: vi.fn() }));
vi.mock('./ApplicationSettingsBootstrapper', () => ({ bootstrapApplicationSettings: mocks.bootstrap }));
vi.mock('./services/regions-districts-service', () => ({ default: class {} }));
import ApplicationSettings from './appset';
import { DEFAULT_BILLING_SETTINGS } from './billingSettingsDefaults';
import { getApplicationSettings } from '../../../controllers/applicationsettings/handler';

let fixture: ReturnType<typeof accountingSqlDatabase>;
beforeEach(() => {
     vi.clearAllMocks();
     fixture = accountingSqlDatabase();
     fixture.native.exec('CREATE TABLE applicationsettings(keyid INTEGER PRIMARY KEY, billingsettings TEXT)');
     mocks.connection.mockResolvedValue(fixture.db);
     mocks.query.mockImplementation(async () => fixture.db('applicationsettings').where({ keyid: 1 }));
     mocks.bootstrap.mockImplementation(async () => {
          await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: JSON.stringify(DEFAULT_BILLING_SETTINGS) });
     });
});
afterEach(async () => fixture.db.destroy());

describe('billing settings initialization', () => {
     it.each([null, '', 'null', '{}', '  { }  '])('persists safe defaults for empty settings %j', async value => {
          await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: value });
          const settings = await new ApplicationSettings().getAllAppSettings(42);
          expect(settings?.billingsettings).toEqual(DEFAULT_BILLING_SETTINGS);
          expect(JSON.parse((await fixture.db('applicationsettings').where({ keyid: 1 }).first()).billingsettings)).toEqual(DEFAULT_BILLING_SETTINGS);
          expect(settings?.billingsettings.hasNightAdjustment).toBe(false);
          expect(mocks.connection).toHaveBeenCalledWith(42);
     });
     it('initializes a missing settings row and returns a populated billing object', async () => {
          const settings = await new ApplicationSettings().getAllAppSettings(42);
          expect(mocks.bootstrap).toHaveBeenCalledWith(42);
          expect(settings?.billingsettings).toEqual(DEFAULT_BILLING_SETTINGS);
          expect(await fixture.db('applicationsettings').where({ keyid: 1 }).first()).toBeDefined();
     });
     it('returns populated billing settings in the target endpoint response', async () => {
          await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: null });
          const response = { send: vi.fn() };
          await getApplicationSettings({ params: { target: 'billingsettings' }, query: { tenantId: 42 } } as any, response as any);
          expect(response.send).toHaveBeenCalledWith({
               statusCode: 200, status: 'success', billingsettings: DEFAULT_BILLING_SETTINGS,
          });
     });
     it('preserves existing configured billing settings and rejects malformed stored JSON', async () => {
          const configured = { ...DEFAULT_BILLING_SETTINGS, hasNightAdjustment: true, nightAdjustmentValue: '5' };
          await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: JSON.stringify(configured) });
          expect((await new ApplicationSettings().getAllAppSettings(42))?.billingsettings).toEqual(configured);
          expect(mocks.connection).not.toHaveBeenCalled();
          await fixture.db('applicationsettings').where({ keyid: 1 }).update({ billingsettings: '{bad' });
          await expect(new ApplicationSettings().getAllAppSettings(42)).rejects.toThrow();
          expect((await fixture.db('applicationsettings').where({ keyid: 1 }).first()).billingsettings).toBe('{bad');
     });
     it('does not replace settings changed after the initial read', async () => {
          const configured = { ...DEFAULT_BILLING_SETTINGS, hasNightAdjustment: true, nightAdjustmentValue: '8' };
          await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: JSON.stringify(configured) });
          mocks.query.mockResolvedValue([{ keyid: 1, billingsettings: null }]);
          expect((await new ApplicationSettings().getAllAppSettings(42))?.billingsettings).toEqual(configured);
          expect(JSON.parse((await fixture.db('applicationsettings').first()).billingsettings)).toEqual(configured);
     });
     it('repairs only the requested tenant', async () => {
          const other = accountingSqlDatabase();
          try {
               other.native.exec('CREATE TABLE applicationsettings(keyid INTEGER PRIMARY KEY, billingsettings TEXT)');
               const configured = { ...DEFAULT_BILLING_SETTINGS, hasNightAdjustment: true };
               await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: null });
               await other.db('applicationsettings').insert({ keyid: 1, billingsettings: JSON.stringify(configured) });
               mocks.connection.mockImplementation(async (tenantId: number) => tenantId === 42 ? fixture.db : other.db);
               mocks.query.mockImplementation(async (tenantId: number) => (tenantId === 42 ? fixture.db : other.db)('applicationsettings').where({ keyid: 1 }));
               expect((await new ApplicationSettings().getAllAppSettings(42))?.billingsettings).toEqual(DEFAULT_BILLING_SETTINGS);
               expect(JSON.parse((await other.db('applicationsettings').first()).billingsettings)).toEqual(configured);
          } finally { await other.db.destroy(); }
     });
     it('returns success for unchanged updates and never accepts empty update payloads', async () => {
          await fixture.db('applicationsettings').insert({ keyid: 1, billingsettings: JSON.stringify(DEFAULT_BILLING_SETTINGS) });
          await expect(ApplicationSettings.updateApplicationBillSettings(42, { ...DEFAULT_BILLING_SETTINGS })).resolves.toBe(1);
          await expect(ApplicationSettings.updateApplicationBillSettings(42, {} as any)).rejects.toThrow('required');
          expect(JSON.parse((await fixture.db('applicationsettings').first()).billingsettings)).toEqual(DEFAULT_BILLING_SETTINGS);
     });
     it('initializes the settings row before a direct billing settings update', async () => {
          const configured = { ...DEFAULT_BILLING_SETTINGS, nightAdjustmentValue: '5' };
          await expect(ApplicationSettings.updateApplicationBillSettings(42, configured)).resolves.toBe(1);
          expect(mocks.bootstrap).toHaveBeenCalledWith(42);
          expect(JSON.parse((await fixture.db('applicationsettings').first()).billingsettings)).toEqual(configured);
     });
});
