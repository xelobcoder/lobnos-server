import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     view: vi.fn(), decrypt: vi.fn(), settings: vi.fn(), company: vi.fn(), patient: vi.fn(),
     comments: vi.fn(), literature: vi.fn(), entry: vi.fn(), drugs: vi.fn(), sampling: vi.fn(), referrer: vi.fn(),
     capture: vi.fn(), revision: vi.fn(), critical: vi.fn(),
}));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(async () => ({})) }));
vi.mock('../operations/ResultReleaseGuard', () => ({ captureReportRevision: mocks.capture, assertReportRevision: mocks.revision }));
vi.mock('../operations/CriticalActionService', () => ({ assertCriticalRelease: mocks.critical }));
vi.mock('../creator/creator', () => ({ default: class { resultPresentationView = mocks.view; getCustomCommentsRecords = mocks.comments; } }));
vi.mock('./resultPrint', () => ({ default: class { static decryptResultArray = mocks.decrypt; getResultEntryScientist = mocks.entry; } }));
vi.mock('../application/appsettings/result-settings/TestReportSettings', () => ({ default: { resolve: mocks.settings } }));
vi.mock('../settings/companyProfile', () => ({ getAllCompanyProfiles: mocks.company }));
vi.mock('../registration/registration', () => ({ default: class { getPatientBasicData = mocks.patient; } }));
vi.mock('../../testpanel/literature', () => ({ default: class { getResultLiterature = mocks.literature; } }));
vi.mock('../operations/ascension', () => ({ TestAscension: { getAscensionSavedDrugs: mocks.drugs, findAscension: mocks.sampling } }));
vi.mock('../services/services', () => ({ Services: { getRefererFacilityByBillingId: mocks.referrer } }));
import { loadLaboratoryReportData } from './LaboratoryReportData';

describe('shared laboratory report data', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.capture.mockResolvedValue({ version: 1 });
          mocks.revision.mockResolvedValue(undefined);
          mocks.critical.mockResolvedValue(undefined);
          mocks.view.mockResolvedValue({ result: [{ name: 'B', value: 'encrypted', ordering: 2 }, { name: 'A', value: 'encrypted', ordering: 1 }],
               testname: 'Panel', hasDrugs: true, testInfo: { method: 'Automated' }, testdetailcategory: [{ categoryid: 1 }] });
          mocks.decrypt.mockImplementation(async rows => rows.map(row => ({ ...row, value: '12.3' })));
          mocks.settings.mockResolvedValue({ fontfamily: 'Inter' });
          mocks.literature.mockResolvedValue({ can: true, literature: 'Reference notes' });
          mocks.entry.mockResolvedValue({ validators: [{ username: 'Verifier' }], resultentry: 'Scientist', enteredOn: null, lastupdatedon: null });
          mocks.drugs.mockResolvedValue([{ drug: 'A', sensitivity: 'Sensitive' }, { drug: 'B', sensitivity: 'Not reported' }]);
          mocks.company.mockResolvedValue({ name: 'Lab' });
          mocks.patient.mockResolvedValue({ firstname: 'Patient' });
          mocks.comments.mockResolvedValue('Comments');
     });
     it('uses facility and per-test settings, ordered/decrypted result fields and real verification metadata', async () => {
          const report = await loadLaboratoryReportData(4, 21, 31, 8, 108, true);
          expect(mocks.view).toHaveBeenCalledWith(4, 8, 31, 21);
          expect(mocks.settings).toHaveBeenCalledWith(4, 8);
          expect(report.records.map(record => record.name)).toEqual(['A', 'B']);
          expect(report.records[0].value).toBe('12.3');
          expect(report.resultsettings).toEqual({ fontfamily: 'Inter' });
          expect(report.drugList).toEqual([{ drug: 'A', sensitivity: 'Sensitive' }]);
          expect(report.validators).toEqual([{ username: 'Verifier' }]);
          expect(report.literatureReview).toBe('Reference notes');
          expect(report.logourl).toContain('tenantId=4');
     });
     it('preserves the staff encrypted-data path when browser decryption was not requested', async () => {
          const report = await loadLaboratoryReportData(4, 21, 31, 8, 108, false);
          expect(mocks.decrypt).not.toHaveBeenCalled();
          expect(report.records[0].value).toBe('encrypted');
     });
     it('fails explicitly when a report could not be loaded', async () => {
          for (const value of [[], 'ERROR', null]) {
               mocks.view.mockResolvedValue(value);
               await expect(loadLaboratoryReportData(4, 21, 31, 8, 108, true)).rejects.toThrow('could not be loaded');
          }
     });
     it('does not release a changed report revision', async () => {
          mocks.revision.mockRejectedValue(new Error('Result revision changed'));
          await expect(loadLaboratoryReportData(4, 21, 31, 8, 108, true)).rejects.toThrow('revision changed');
     });
     it('enforces critical release controls before loading clinical data', async () => {
          mocks.critical.mockRejectedValue(new Error('Critical release blocked'));
          await expect(loadLaboratoryReportData(4, 21, 31, 8, 108, true)).rejects.toThrow('Critical release blocked');
          expect(mocks.view).not.toHaveBeenCalled();
     });
});
