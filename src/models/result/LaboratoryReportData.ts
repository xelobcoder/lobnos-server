import {explicitResultReleaseRequired} from '../operations/ResultReleaseGuard';
import { captureReportRevision, assertReportRevision, assertResultFormallyReleased } from '../operations/ResultReleaseGuard';
import KnexConnection from '../../database/KnexConnections';
import { assertCriticalRelease } from '../operations/CriticalActionService';
import type { resultPrintOutDataset } from '../../controllers/result/resultHandlers';
import Creator from '../creator/creator';
import ResultPrint from './resultPrint';
import TestReportSettings from '../application/appsettings/result-settings/TestReportSettings';
import { getAllCompanyProfiles } from '../settings/companyProfile';
import Registration from '../registration/registration';
import TestLiteratureSetup from '../../testpanel/literature';
import { TestAscension } from '../operations/ascension';
import { Services } from '../services/services';
import { assertResultPaymentPolicy } from '../operations/ResultPaymentPolicy';
import { labAccessSettings, reportAmendmentSignoffRequired } from '../operations/LabAccessPolicy';
import { archiveLaboratoryReport, laboratoryPrintSnapshot, plainLaboratoryText, readReportSnapshot } from './LaboratoryReportVersions';
import { encrypt_value } from '../../utils/encryptionModels';

/** Call only after the caller has authorized this patient, bill and ascension. */
export async function loadLaboratoryReportData(
     tenantId: number, patientid: number, billingid: number, testid: number, ascensionId: number,
     decrypt: boolean, channel: 'print' | 'release' = 'print',
     revisionWitness?: (revision: number) => void,
): Promise<resultPrintOutDataset> {
     const controlDb = await KnexConnection(tenantId);
     const order = await controlDb('test_ascension').where({ id: ascensionId }).first('billingid', 'testid');
     const bill = await controlDb('billing').where({ billingid }).first('patientid');
     if (!order || Number(order.billingid) !== billingid || Number(order.testid) !== testid || Number(bill?.patientid) !== patientid) {
          throw Object.assign(new Error('The result does not belong to this patient and billing request'), { statusCode: 403 });
     }
     if (channel === 'print') await assertResultPaymentPolicy(controlDb, ascensionId, 'print');
     const revision = await captureReportRevision(controlDb, ascensionId, channel);
     await assertCriticalRelease(controlDb, ascensionId, channel);
     const creator = new Creator(testid);
     const view = await creator.resultPresentationView(tenantId, testid, billingid, patientid);
     if (!view || typeof view === 'string' || Array.isArray(view)) {
          throw new Error('The laboratory report could not be loaded');
     }
     const settings = await TestReportSettings.resolve(tenantId, testid);
     const scopedRecords = Array.isArray(view.result)
          ? view.result.filter((row: any) => row.ascensionid == null || Number(row.ascensionid) === ascensionId) : view.result;
     if (Array.isArray(view.result) && view.result.length && !scopedRecords.length) {
          throw Object.assign(new Error('No report records were found for this ordered test'), { statusCode: 409 });
     }
     const records = decrypt && Array.isArray(scopedRecords)
          ? await ResultPrint.decryptResultArray(scopedRecords) : scopedRecords;
     const literature = await new TestLiteratureSetup('').getResultLiterature(tenantId, testid);
     const entry = await new ResultPrint(billingid).getResultEntryScientist(tenantId, billingid, testid, ascensionId);
     const savedDrugs = view.hasDrugs ? await TestAscension.getAscensionSavedDrugs(tenantId, ascensionId, testid) : [];
     const hostname = process.env.NODE_ENV === 'development'
          ? `${process.env.APPHOST_DEVELOPMENT}:${process.env.DEVELOPMENT_PORT}` : process.env.APPHOST_PRODUCTION;
     const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
     const dataset: resultPrintOutDataset = {
          resultsettings: typeof settings === 'boolean' ? null : settings,
          records: Array.isArray(records) ? [...records].sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0)) : records,
          companyInfo: await getAllCompanyProfiles(tenantId),
          patientInformation: await new Registration().getPatientBasicData(tenantId, patientid),
          comments: await creator.getCustomCommentsRecords(tenantId, billingid, testid),
          literatureReview: literature.can !== false ? literature.literature : null,
          testname: plainLaboratoryText(view.testname),
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
     await assertReportRevision(controlDb, ascensionId, revision, channel);
     revisionWitness?.(revision);
     return dataset;
}

export async function loadReleasedLaboratoryReport(
     tenantId: number, patientid: number, billingid: number, testid: number, ascensionId: number,
     decrypt: boolean, channel: 'print' | 'release' = 'print',
) {
     let revision = -1;
     const dataset = await loadLaboratoryReportData(tenantId, patientid, billingid, testid, ascensionId, true, channel, value => { revision = value; });
     const db = await KnexConnection(tenantId);
     await assertResultFormallyReleased(db, ascensionId, revision);
     const requireSignoff = await explicitResultReleaseRequired(db) && reportAmendmentSignoffRequired(await labAccessSettings(db));
     const archive = await archiveLaboratoryReport(db, ascensionId, revision, dataset, channel, undefined, requireSignoff);
     const snapshot = readReportSnapshot(archive) as resultPrintOutDataset;
     if (!decrypt && Array.isArray(snapshot.records)) {
          snapshot.records = snapshot.records.map((row: any) => ({
               ...row, value: encrypt_value(String(row.value ?? '')), originalvalue: encrypt_value(String(row.originalvalue ?? '')),
          }));
     }
     return laboratoryPrintSnapshot(snapshot);
}
