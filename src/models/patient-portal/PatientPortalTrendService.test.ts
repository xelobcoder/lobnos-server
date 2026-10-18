import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';

const mocks = vi.hoisted(() => ({
     connection: vi.fn(), settings: vi.fn(), patient: vi.fn(), appSettings: vi.fn(), decrypt: vi.fn(),
}));
vi.mock('./PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: mocks.connection }));
vi.mock('./PatientPortalSettings', () => ({ PatientPortalSettingsService: class { get = mocks.settings; } }));
vi.mock('../registration/registration', () => ({ default: class { getPatientBasicData = mocks.patient; } }));
vi.mock('../application/appsettings/appset', () => ({ default: class { getAllAppSettings = mocks.appSettings; } }));
vi.mock('../../utils/encryptionModels', () => ({ decrypt_value: mocks.decrypt }));

import { PatientPortalTrendService, trendNumber } from './PatientPortalTrendService';

const sql = knex({ client: 'mysql2' });
const queries: { table: string; sql: string; bindings: readonly unknown[] }[] = [];
let ascensions: any[], records: any[];
const released = (overrides: any = {}) => ({
     ascensionid: 101, testid: 8, billingid: 31, testname: 'Example panel',
     collectionStartDate: '2026-01-01', processingStartDate: '2026-01-01',
     resultEntryEnd: '2026-01-02', paymentstatus: 'paid', isapproved: 1,
     approvedBy: '', minvalidation: 1, releaseStatus: 'released', ...overrides,
});
const record = (overrides: any = {}) => ({
     ascensionid: 101, billingid: 31, fieldid: 2, field: 'Example measurement',
     value: 'cipher', created_on: '2026-01-02', units: 'g/L', plan: 'limits',
     lowerlimit: '1', upperlimit: '9', lowerLimitFemale: '2', upperLimitFemale: '8', ...overrides,
});

beforeEach(() => {
     vi.clearAllMocks();
     queries.length = 0;
     ascensions = [released()];
     records = [record()];
     mocks.settings.mockResolvedValue({ portal_enabled: true, result_release_policy: 'manual', require_payment_for_results: true });
     mocks.patient.mockResolvedValue({ gender: 'female', age: 30, agetype: 'years' });
     mocks.appSettings.mockResolvedValue({});
     mocks.decrypt.mockReturnValue('5.2');
     mocks.connection.mockImplementation(async () => (table: string) => {
          const builder: any = sql(table);
          builder.then = (resolve: any, reject: any) => {
               const query = builder.toSQL();
               queries.push({ table, sql: query.sql, bindings: query.bindings });
               return Promise.resolve(table === 'test_ascension as ta' ? ascensions : records).then(resolve, reject);
          };
          return builder;
     });
});

describe('strict numeric trend values', () => {
     it.each([null, undefined, '', ' ', '<5', '>10', '12 mg/L', '1,000', 'positive', 'NaN', 'Infinity', '0x10', {}, true])('does not invent a measurement for %s', value => {
          expect(trendNumber(value)).toBeNull();
     });
     it.each([['0', 0], ['-1.5', -1.5], ['.25', .25], [' 2 ', 2], ['1e2', 100]])('accepts numeric %s', (value, number) => {
          expect(trendNumber(value)).toBe(number);
     });
});

describe('patient released trend history', () => {
     it('applies ownership and cancellation constraints before reading any values', async () => {
          const result = await new PatientPortalTrendService(4).history(21, 8);
          expect(mocks.connection).toHaveBeenCalledWith(4);
          const eligibility = queries[0];
          expect(eligibility.sql).toContain('`b`.`patientid` = ?');
          expect(eligibility.bindings).toEqual(expect.arrayContaining([21, 'voided', 'cancelled', 'refunded', 0, 8]));
          expect(eligibility.sql).not.toContain('limit');
          const values = queries[1];
          expect(values.sql).toContain('`ta`.`billingid` = `tr`.`billingid`');
          expect(values.sql).toContain('`ta`.`testid` = `tr`.`testid`');
          expect(values.sql).toContain('`tr`.`patientid` = ?');
          expect(values.bindings).toEqual([21, 8, 101]);
          expect(result.rows[0]).toMatchObject({ value: '5.2', numericValue: 5.2, lowerlimit: '2', upperlimit: '8', units: 'g/L' });
          expect(JSON.stringify(result)).not.toMatch(/cipher|approvedBy|paymentstatus|employeeid|lowerLimitFemale/);
          expect(result).toMatchObject({ page: 1, count: 25, total: 1, totalPages: 1 });
     });

     it.each([
          { resultEntryEnd: null },
          { isapproved: 0, approvedBy: '' },
          { paymentstatus: 'unpaid' },
          { releaseStatus: undefined },
          { releaseStatus: 'withdrawn' },
     ])('never loads or decrypts a result failing release policy: %j', async overrides => {
          ascensions = [released(overrides)];
          const service = new PatientPortalTrendService(4);
          expect((await service.history(21, 8)).rows).toEqual([]);
          expect(await service.listTests(21)).toEqual([]);
          expect(mocks.decrypt).not.toHaveBeenCalled();
          expect(queries.every(query => query.table === 'test_ascension as ta')).toBe(true);
     });

     it('supports the canonical minimum-approver and automatic-release rules, but withdrawal still wins', async () => {
          mocks.settings.mockResolvedValue({ portal_enabled: true, result_release_policy: 'approved', require_payment_for_results: false });
          ascensions = [released({ isapproved: 0, approvedBy: '2,3', minvalidation: 2, releaseStatus: undefined, paymentstatus: 'unpaid' }),
               released({ ascensionid: 102, releaseStatus: 'withdrawn' })];
          const result = await new PatientPortalTrendService(4).history(21, 8);
          expect(result.total).toBe(1);
          expect(queries[1].bindings).toEqual([21, 8, 101]);
     });

     it('paginates eligible ascensions on the server and never fetches another page of values', async () => {
          ascensions = Array.from({ length: 30 }, (_, i) => released({ ascensionid: 200 - i }));
          const result = await new PatientPortalTrendService(4).history(21, 8, 2, 10);
          expect(result).toMatchObject({ page: 2, count: 10, total: 30, totalPages: 3 });
          expect(queries[1].bindings).toEqual([21, 8, ...Array.from({ length: 10 }, (_, i) => 190 - i)]);
     });

     it('lists released tests only and does not decrypt values for the selector', async () => {
          ascensions = [released(), released({ ascensionid: 102 }), released({ ascensionid: 103, testid: 9, releaseStatus: 'withdrawn' })];
          expect(await new PatientPortalTrendService(4).listTests(21)).toEqual([{ testid: 8, testname: 'Example panel', resultCount: 2 }]);
          expect(mocks.decrypt).not.toHaveBeenCalled();
     });

     it('preserves categorical, qualified and zero values without fabricating numeric data', async () => {
          records = [record(), record({ value: '' }), record({ value: null }), record({ value: 'zero' })];
          mocks.decrypt.mockImplementation(value => value === 'zero' ? '0' : '<5');
          const result = await new PatientPortalTrendService(4).history(21, 8);
          expect(result.rows.map(row => [row.value, row.numericValue])).toEqual([['<5', null], ['', null], ['', null], ['0', 0]]);
     });

     it('fails closed when the portal is disabled', async () => {
          mocks.settings.mockResolvedValue({ portal_enabled: false });
          await expect(new PatientPortalTrendService(4).history(21, 8)).rejects.toMatchObject({ statusCode: 403 });
          expect(queries).toHaveLength(0);
          expect(mocks.decrypt).not.toHaveBeenCalled();
     });

     it('fails the whole response rather than silently dropping an unreadable result', async () => {
          records = [record(), record({ value: 'unreadable' })];
          mocks.decrypt.mockImplementation(value => {
               if (value === 'unreadable') throw new Error('Unable to decrypt');
               return '5';
          });
          await expect(new PatientPortalTrendService(4).history(21, 8)).rejects.toThrow('Unable to decrypt');
     });

     it.each([[0, 25], [1, 101], [1.5, 25]])('rejects invalid pagination %s/%s', async (page, count) => {
          await expect(new PatientPortalTrendService(4).history(21, 8, page, count)).rejects.toMatchObject({ statusCode: 400 });
          expect(mocks.connection).not.toHaveBeenCalled();
     });
});
