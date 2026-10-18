import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientPortalError } from './PatientPortalAccountService';
import { evaluateResultRelease } from './PatientPortalResultService';
import Registration from '../registration/registration';
import ApplicationSettings from '../application/appsettings/appset';
import { applyDemographicLimits, getAgeGroup } from '../creator/demographic-limits';
import { decrypt_value } from '../../utils/encryptionModels';

/** Never turn empty, qualified ("<5"), categorical or decorated values into measurements. */
export function trendNumber(value: unknown): number | null {
     if (typeof value !== 'string' && typeof value !== 'number') return null;
     const text = String(value).trim();
     if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
     const number = Number(text);
     return Number.isFinite(number) ? number : null;
}

export class PatientPortalTrendService {
     constructor(private readonly tenantId: number) {}

     /**
      * Metadata only until the canonical portal release gate has authorized each ascension.
      * Do not use the staff trend loader: it does not enforce release or billing eligibility.
      * No fixed history limit: pagination is applied AFTER release eligibility is established.
      */
     private async releasedTests(patientid: number, testid?: number) {
          const connection = await bootstrapPatientPortal(this.tenantId);
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.portal_enabled) throw new PatientPortalError('The patient portal is disabled', 403, 'PORTAL_DISABLED');
          const query = connection('test_ascension as ta')
               .join('billing as b', 'b.billingid', 'ta.billingid')
               .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
               .leftJoin('dboservices as ds', 'ds.serviceid', 'ta.serviceid')
               .leftJoin('dbotestresultapproval as a', 'a.ascensionid', 'ta.id')
               .leftJoin('patient_portal_result_releases as r', 'r.ascension_id', 'ta.id')
               .where('b.patientid', patientid)
               .andWhere(q => q.whereNull('b.status').orWhereNot('b.status', 'voided'))
               .andWhere(q => q.whereNull('ds.status').orWhereNotIn('ds.status', ['cancelled', 'voided', 'refunded']))
               .andWhere(q => q.whereNull('ds.isDeleted').orWhere('ds.isDeleted', 0))
               .select('ta.id as ascensionid', 'ta.testid', 'ta.billingid', 'tp.name as testname',
                    'ta.collectionStartDate', 'ta.processingStartDate', 'ta.resultEntryEnd', 'ds.paymentstatus',
                    'a.isapproved', 'a.approvedBy', 'a.minvalidation', 'r.status as releaseStatus')
               .orderBy('ta.resultEntryEnd', 'desc').orderBy('ta.id', 'desc');
          if (testid !== undefined) query.andWhere('ta.testid', testid);
          const rows: any[] = await query;
          return rows.filter(row => evaluateResultRelease({
               ...row, approval: row, release: { status: row.releaseStatus },
          }, settings).released);
     }

     async listTests(patientid: number) {
          const rows = await this.releasedTests(patientid);
          const tests = new Map<number, { testid: number; testname: string; resultCount: number }>();
          for (const row of rows) {
               const id = Number(row.testid);
               const item = tests.get(id) || { testid: id, testname: row.testname || 'Laboratory test', resultCount: 0 };
               item.resultCount++;
               tests.set(id, item);
          }
          return [...tests.values()].sort((a, b) => a.testname.localeCompare(b.testname));
     }

     async history(patientid: number, testid: number, page = 1, count = 25) {
          if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(count) || count < 1 || count > 100) {
               throw new PatientPortalError('Invalid pagination', 400);
          }
          const eligible = await this.releasedTests(patientid, testid);
          const total = eligible.length;
          const visits = eligible.slice((page - 1) * count, page * count);
          const pagination = { page, count, total, totalPages: Math.ceil(total / count) };
          const referenceNote = 'Reference ranges reflect the current laboratory configuration and patient demographics, as in staff trends. Consult the released report for clinical interpretation.';
          if (!visits.length) return { testid, testname: eligible[0]?.testname || '', rows: [], ...pagination, referenceNote };

          const connection = await bootstrapPatientPortal(this.tenantId);
          const [patient, appSettings, records] = await Promise.all([
               new Registration().getPatientBasicData(this.tenantId, patientid),
               new ApplicationSettings().getAllAppSettings(this.tenantId),
               connection('test_results as tr')
                    .join('test_ascension as ta', function () {
                         this.on('ta.id', '=', 'tr.ascensionid').andOn('ta.billingid', '=', 'tr.billingid').andOn('ta.testid', '=', 'tr.testid');
                    })
                    .leftJoin('testcreationrules as tcr', 'tcr.id', 'tr.fieldid')
                    .where('tr.patientid', patientid).andWhere('tr.testid', testid)
                    .whereIn('tr.ascensionid', visits.map(row => Number(row.ascensionid)))
                    .select('tr.ascensionid', 'tr.billingid', 'tr.fieldid', 'tr.field', 'tr.value', 'tr.created_on',
                         'tcr.units', 'tcr.plan', 'tcr.textReference', 'tcr.lowerlimit', 'tcr.upperlimit',
                         'tcr.lowerLimitFemale', 'tcr.upperLimitFemale', 'tcr.lowerLimitMale', 'tcr.upperLimitMale',
                         'tcr.lowerLimitChildren', 'tcr.upperLimitChildren', 'tcr.lowerLimitNeonates', 'tcr.upperLimitNeonates')
                    .orderBy('tr.created_on', 'desc').orderBy('tr.ascensionid', 'desc'),
          ]);
          const ageGroup = getAgeGroup(patient?.age, (patient as any)?.ageType || (patient as any)?.agetype, appSettings?.ageVariationLimits);
          const visitById = new Map(visits.map(row => [Number(row.ascensionid), row]));
          const rows = records.map((row: any) => {
               const rule = applyDemographicLimits(row, String(patient?.gender || ''), ageGroup);
               const value = row.value == null || row.value === '' ? '' : String(decrypt_value(row.value));
               return {
                    ascensionid: Number(row.ascensionid), billingid: Number(row.billingid),
                    fieldid: row.fieldid == null ? null : Number(row.fieldid), field: String(row.field || 'Result'),
                    value, numericValue: trendNumber(value), recordedOn: row.created_on,
                    completedOn: visitById.get(Number(row.ascensionid))?.resultEntryEnd || null,
                    units: String(row.units || ''), plan: String(row.plan || ''),
                    lowerlimit: rule.lowerlimit ?? null, upperlimit: rule.upperlimit ?? null,
                    textReference: String(row.textReference || ''),
               };
          });
          return { testid, testname: eligible[0]?.testname || 'Laboratory test', rows, ...pagination, referenceNote };
     }
}
