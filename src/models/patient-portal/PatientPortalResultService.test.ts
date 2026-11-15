import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), patient: vi.fn(), company: vi.fn(), connection: vi.fn() }));
vi.mock('../result/LaboratoryReportData', () => ({ loadReleasedLaboratoryReport: mocks.load }));
vi.mock('../settings/companyProfile', () => ({ getAllCompanyProfiles: mocks.company }));
vi.mock('./PatientPortalBootstrapper', () => ({
     bootstrapPatientPortal: mocks.connection,
}));
vi.mock('./PatientPortalSettings', () => ({
     PatientPortalSettingsService: class { async get() { return { result_release_policy: 'approved', require_payment_for_results: true }; } },
}));
import { PatientPortalResultService, portalResultDateRange, isResultApproved } from './PatientPortalResultService';
import knex from 'knex';

describe('patient canonical laboratory reports', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.patient.mockResolvedValue({ firstname: 'Ama', lastname: 'Patient', fullpatientid: 'P021' });
          mocks.company.mockResolvedValue({ name: 'Facility' });
          mocks.connection.mockResolvedValue(() => ({ select: () => ({ where: () => ({ first: mocks.patient }) }) }));
     });
     const test = (released: boolean, testid = 8) => ({
          ascensionid: testid + 100, testid, billingid: 31, released, testname: 'Blood count',
          requestedOn: null, stage: 'verified' as const, pending: null, completedOn: '2026-10-18',
     });
     const report = () => ({
          records: [{ name: 'Haemoglobin', value: '8.2', units: 'g/dL', plan: 'limits', lowerlimit: 12,
               upperlimit: 16, textReference: '', flag: 'L', ordering: 1, categoryid: 4,
               originalvalue: 'encrypted-secret', employeeid: 99, internalNote: 'private' }],
          resultsettings: { fontfamily: 'Inter', includeSignature: true },
          companyInfo: { name: 'Facility' }, testname: 'Blood count',
          patientInformation: { firstname: 'Ama', lastname: 'Patient', middlename: '', fullpatientid: 'P021',
               gender: 'female', age: 30, agetype: 'years', email: 'private@example.test' },
          testInfo: { reportitle: 'Full blood count', method: 'Automated', instrumentation: 'Analyzer', price: 100 },
          testdetailcategory: [{ categoryid: 4, categoryname: 'Haematology', createdby: 'private' }],
          drugList: [{ id: 1, drug: 'Ampicillin', sensitivity: 'Resistant' }], hasDrugs: true,
          comments: '<p>Review with clinician.</p>', literatureReview: '<p>Clinical notes</p>',
          samplingInformation: { collectionEndDate: '2026-10-17', resultEntryEnd: '2026-10-18', employeeid: 77 },
          validators: [{ username: 'Verified scientist', employeeid: 3, mobile: 'private' }],
          resultentry: 'Entry scientist', enteredOn: '2026-10-17', lastupdatedon: '2026-10-18',
          logourl: '/api/v1/settings/companyprofile/images?tenantId=4',
          generalValidation: { username: 'Not a clinical validator', mobile: 'private' },
     });

     it('loads only released tests through the canonical staff data loader within the authenticated facility', async () => {
          const service = new PatientPortalResultService(4);
          const list = vi.spyOn(service, 'listTests').mockResolvedValue([test(false, 9), test(true)]);
          mocks.load.mockResolvedValue(report());
          const result = await service.getReport(21, 31);
          expect(list).toHaveBeenCalledWith(21, { billingid: 31 });
          expect(mocks.load).toHaveBeenCalledExactlyOnceWith(4, 21, 31, 8, 108, true, 'release');
          expect(result.reports).toHaveLength(1);
          const document = result.reports[0];
          expect(document.records[0]).toMatchObject({ value: '8.2', units: 'g/dL', flag: 'L', lowerlimit: 12, upperlimit: 16, categoryid: 4 });
          expect(document.testInfo).toEqual({ reportitle: 'Full blood count', method: 'Automated', instrumentation: 'Analyzer' });
          expect(document.testdetailcategory).toEqual([{ categoryid: 4, categoryname: 'Haematology' }]);
          expect(document.drugList[0]).toMatchObject({ drug: 'Ampicillin', sensitivity: 'Resistant' });
          expect(document.comments).toContain('Review with clinician');
          expect(document.validators).toEqual([{ username: 'Verified scientist', employeeid: 3 }]);
          expect(JSON.stringify(document)).not.toMatch(/private|encrypted-secret|originalvalue|generalValidation|internalNote/);
     });

     it('never calls the report loader for a bill without released tests, including another patient bill', async () => {
          for (const rows of [[], [test(false)]]) {
               const service = new PatientPortalResultService(4);
               vi.spyOn(service, 'listTests').mockResolvedValue(rows);
               await expect(service.getReport(21, 999)).rejects.toMatchObject({ statusCode: 404 });
          }
          expect(mocks.load).not.toHaveBeenCalled();
     });

     it('does not silently omit a failed panel from a multi-panel report', async () => {
          const service = new PatientPortalResultService(4);
          vi.spyOn(service, 'listTests').mockResolvedValue([test(true), test(true, 9)]);
          mocks.load.mockResolvedValueOnce(report()).mockRejectedValueOnce(new Error('Report unavailable'));
          await expect(service.getReport(21, 31)).rejects.toThrow('Report unavailable');
     });

     it('scopes the actual report lookup to the authenticated patient and requested bill before reading any values', async () => {
          const database = knex({ client: 'mysql2' });
          const sql: string[] = [];
          mocks.connection.mockResolvedValue((table: string) => {
               const query = database(table);
               query.then = (resolve, reject) => {
                    sql.push(query.toQuery());
                    return Promise.resolve([]).then(resolve, reject);
               };
               return query;
          });
          await expect(new PatientPortalResultService(4).getReport(21, 999)).rejects.toMatchObject({ statusCode: 404 });
          expect(sql[0]).toContain('`b`.`patientid` = 21');
          expect(sql[0]).toContain('`ta`.`billingid` = 999');
          expect(sql[0]).toContain('`ds`.`status` not in');
          expect(sql[0]).toContain('`ds`.`isDeleted` = 0');
          expect(mocks.load).not.toHaveBeenCalled();
          await database.destroy();
     });

     it('validates inclusive result date ranges without accepting impossible, repeated or reversed dates', () => {
          expect(portalResultDateRange(undefined, undefined)).toEqual({});
          expect(portalResultDateRange('2026-10-18', '2026-10-18')).toEqual({ from: '2026-10-18', to: '2026-10-18' });
          for (const [from, to] of [
               ['2026-02-30', '2026-03-01'], ['2026-10-19', '2026-10-18'],
               ['2026-10-18', undefined], [undefined, '2026-10-18'],
               [['2026-10-18'], '2026-10-18'], ['', ''], ['invalid', '2026-10-18'],
          ]) expect(() => portalResultDateRange(from, to)).toThrow(/valid start and end date/);
     });

     it('filters request dates in SQL before limiting results while retaining patient ownership', async () => {
          const database = knex({ client: 'mysql2' });
          const queries: { sql: string; bindings: readonly unknown[] }[] = [];
          mocks.connection.mockResolvedValue((table: string) => {
               const query = database(table);
               query.then = (resolve, reject) => {
                    queries.push(query.toSQL());
                    return Promise.resolve([]).then(resolve, reject);
               };
               return query;
          });
          await new PatientPortalResultService(4).listTests(21, { from: '2020-01-01', to: '2020-01-31' });
          expect(queries[0].sql).toContain('DATE(b.billedon) BETWEEN ? AND ?');
          expect(queries[0].sql).toContain('`b`.`patientid` = ?');
          expect(queries[0].bindings).toEqual(expect.arrayContaining([21, '2020-01-01', '2020-01-31', 500]));
          await database.destroy();
     });
});

describe('amended result release gate', () => {
     it('withholds edited results even if a stale approval summary remains set', () => {
          expect(isResultApproved({ isapproved: 1, approvedBy: '7,8', minvalidation: 2, requires_revalidation: 1 })).toBe(false);
          expect(isResultApproved({ isapproved: 1, approvedBy: '7,8', minvalidation: 2, requires_revalidation: 0 })).toBe(true);
     });
});
