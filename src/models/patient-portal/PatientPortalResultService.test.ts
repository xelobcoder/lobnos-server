import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), patient: vi.fn(), company: vi.fn(), connection: vi.fn() }));
vi.mock('../result/LaboratoryReportData', () => ({ loadLaboratoryReportData: mocks.load }));
vi.mock('../settings/companyProfile', () => ({ getAllCompanyProfiles: mocks.company }));
vi.mock('./PatientPortalBootstrapper', () => ({
     bootstrapPatientPortal: mocks.connection,
}));
vi.mock('./PatientPortalSettings', () => ({
     PatientPortalSettingsService: class { async get() { return { result_release_policy: 'approved', require_payment_for_results: true }; } },
}));
import { PatientPortalResultService } from './PatientPortalResultService';
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
          expect(mocks.load).toHaveBeenCalledExactlyOnceWith(4, 21, 31, 8, 108, true);
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
});
