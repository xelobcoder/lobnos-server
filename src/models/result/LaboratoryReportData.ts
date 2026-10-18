import type { resultPrintOutDataset } from '../../controllers/result/resultHandlers';
import Creator from '../creator/creator';
import ResultPrint from './resultPrint';
import TestReportSettings from '../application/appsettings/result-settings/TestReportSettings';
import { getAllCompanyProfiles } from '../settings/companyProfile';
import Registration from '../registration/registration';
import TestLiteratureSetup from '../../testpanel/literature';
import { TestAscension } from '../operations/ascension';
import { Services } from '../services/services';

/** Call only after the caller has authorized this patient, bill and ascension. */
export async function loadLaboratoryReportData(
     tenantId: number, patientid: number, billingid: number, testid: number, ascensionId: number,
     decrypt: boolean,
): Promise<resultPrintOutDataset> {
     const creator = new Creator(testid);
     const view = await creator.resultPresentationView(tenantId, testid, billingid, patientid);
     if (!view || typeof view === 'string' || Array.isArray(view)) {
          throw new Error('The laboratory report could not be loaded');
     }
     const settings = await TestReportSettings.resolve(tenantId, testid);
     const records = decrypt && Array.isArray(view.result)
          ? await ResultPrint.decryptResultArray(view.result) : view.result;
     const literature = await new TestLiteratureSetup('').getResultLiterature(tenantId, testid);
     const entry = await new ResultPrint(billingid).getResultEntryScientist(tenantId, billingid, testid, ascensionId);
     const savedDrugs = view.hasDrugs ? await TestAscension.getAscensionSavedDrugs(tenantId, ascensionId, testid) : [];
     const hostname = process.env.NODE_ENV === 'development'
          ? `${process.env.APPHOST_DEVELOPMENT}:${process.env.DEVELOPMENT_PORT}` : process.env.APPHOST_PRODUCTION;
     const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
     return {
          resultsettings: typeof settings === 'boolean' ? null : settings,
          records: Array.isArray(records) ? [...records].sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0)) : records,
          companyInfo: await getAllCompanyProfiles(tenantId),
          patientInformation: await new Registration().getPatientBasicData(tenantId, patientid),
          comments: await creator.getCustomCommentsRecords(tenantId, billingid, testid),
          literatureReview: literature.can !== false ? literature.literature : null,
          testname: view.testname,
          hasDrugs: view.hasDrugs,
          testInfo: view.testInfo || null,
          testdetailcategory: view.testdetailcategory || null,
          drugList: Array.isArray(savedDrugs)
               ? savedDrugs.filter(drug => ['Resistant', 'Sensitive'].includes(drug.sensitivity)) : [],
          samplingInformation: await TestAscension.findAscension(tenantId, ascensionId),
          referrerFacility: await Services.getRefererFacilityByBillingId(tenantId, billingid),
          validators: entry.validators,
          resultentry: entry.resultentry,
          lastupdatedon: entry.lastupdatedon ? new Date(entry.lastupdatedon) : null,
          enteredOn: entry.enteredOn ? new Date(entry.enteredOn) : null,
          logourl: `${protocol}://${hostname}/api/v1/settings/companyprofile/images?tenantId=${tenantId}`,
          patientid, billingid,
     };
}
