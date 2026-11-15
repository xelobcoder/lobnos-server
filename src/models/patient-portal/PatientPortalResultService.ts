import { Knex } from 'knex';
import { getAllCompanyProfiles } from '../settings/companyProfile';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettings, PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientPortalError } from './PatientPortalAccountService';
import { loadReleasedLaboratoryReport } from '../result/LaboratoryReportData';

export type PatientResultStage = 'registered' | 'collected' | 'processing' | 'completed' | 'verified';

export interface ResultReleaseInput {
     collectionStartDate?: unknown;
     processingStartDate?: unknown;
     resultEntryEnd?: unknown;
     paymentstatus?: string | null;
     approval?: { critical_release_hold?: unknown; requires_revalidation?: unknown; isapproved?: unknown; approvedBy?: unknown; minvalidation?: unknown } | null;
     release?: { status?: string } | null;
}

export interface ResultReleaseDecision {
     stage: PatientResultStage;
     released: boolean;
     /** Patient-facing explanation for results that are not yet available. */
     pending: 'in_progress' | 'awaiting_verification' | 'awaiting_payment' | 'awaiting_release' | null;
}

export function portalResultDateRange(from: unknown, to: unknown): { from?: string; to?: string } {
     if (from === undefined && to === undefined) return {};
     const valid = (value: unknown): value is string => typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value;
     if (!valid(from) || !valid(to) || from > to) {
          throw new PatientPortalError('Provide a valid start and end date, with the start no later than the end.', 400);
     }
     return { from, to };
}

/** Mirrors ResultSettings.isApprovalLimitReached(..., 'minimum') without a query per test. */
export function isResultApproved(approval: ResultReleaseInput['approval']): boolean {
     if (!approval || Number(approval.requires_revalidation) === 1 || Number(approval.critical_release_hold) === 1) return false;
     if (Number(approval.isapproved) === 1) return true;
     const approvers = String(approval.approvedBy ?? '').split(',')
          .map(value => parseInt(value.trim(), 10)).filter(value => !isNaN(value));
     const minimum = parseInt(String(approval.minvalidation ?? ''), 10);
     return approvers.length > 0 && minimum > 0 && approvers.length >= minimum;
}

/**
 * The single release gate for patient-visible results. Results are only shown once entry is complete,
 * the facility's minimum verification is met, payment rules are satisfied and — under the manual
 * policy — staff explicitly released them. A withdrawal always hides the result.
 */
export function evaluateResultRelease(input: ResultReleaseInput, settings: Pick<PatientPortalSettings, 'result_release_policy' | 'require_payment_for_results'>): ResultReleaseDecision {
     const approved = !!input.resultEntryEnd && isResultApproved(input.approval);
     const stage: PatientResultStage = approved ? 'verified'
          : input.resultEntryEnd ? 'completed'
               : input.processingStartDate ? 'processing'
                    : input.collectionStartDate ? 'collected' : 'registered';
     if (!input.resultEntryEnd) return { stage, released: false, pending: 'in_progress' };
     if (!approved) return { stage, released: false, pending: 'awaiting_verification' };
     if (input.release?.status === 'withdrawn') return { stage, released: false, pending: 'awaiting_release' };
     if (settings.require_payment_for_results && String(input.paymentstatus || '').toLowerCase() !== 'paid') {
          return { stage, released: false, pending: 'awaiting_payment' };
     }
     if (settings.result_release_policy === 'manual' && input.release?.status !== 'released') {
          return { stage, released: false, pending: 'awaiting_release' };
     }
     return { stage, released: true, pending: null };
}

type LaboratoryReportDataset = Awaited<ReturnType<typeof loadReleasedLaboratoryReport>>;

/**
 * Shares the staff renderer's data contract with external portals (patients, clinicians),
 * but never sends internal rows or staff contacts.
 */
export function toExternalLaboratoryReport(report: LaboratoryReportDataset, ascensionid: number, billingid: number, patientid: number) {
     const records = (report.records || []).map(record => ({
          name: record.name ?? record.field ?? record.parameter ?? '',
          value: record.value ?? '',
          units: record.units ?? record.unit ?? '',
          lowerlimit: record.lowerlimit ?? null, upperlimit: record.upperlimit ?? null,
          flag: record.flag ?? record.indicator ?? null,
          plan: record.plan, plain: record.plain, textReference: record.textReference,
          ordering: record.ordering, categoryid: record.categoryid,
     }));
     return {
          ascensionid, billingid, patientid,
          resultsettings: report.resultsettings,
          companyInfo: report.companyInfo,
          patientInformation: report.patientInformation ? {
               firstname: report.patientInformation.firstname, middlename: report.patientInformation.middlename || '',
               lastname: report.patientInformation.lastname, fullpatientid: report.patientInformation.fullpatientid,
               age: report.patientInformation.age,
               agetype: 'agetype' in report.patientInformation ? report.patientInformation.agetype : report.patientInformation.ageType,
               gender: report.patientInformation.gender || '', organization: '',
          } : null,
          records, testname: report.testname, comments: report.comments,
          literatureReview: report.literatureReview, hasDrugs: report.hasDrugs,
          drugList: (report.drugList || []).map(drug => ({
               id: drug.id, ascensionid, drug: drug.drug, sensitivity: drug.sensitivity,
          })),
          testInfo: report.testInfo ? {
               reportitle: 'reportitle' in report.testInfo ? report.testInfo.reportitle : undefined,
               method: 'method' in report.testInfo ? report.testInfo.method : undefined,
               instrumentation: 'instrumentation' in report.testInfo ? report.testInfo.instrumentation : undefined,
          } : null,
          testdetailcategory: (report.testdetailcategory || []).map(category => ({
               categoryid: category.categoryid, categoryname: category.categoryname,
          })),
          samplingInformation: report.samplingInformation ? {
               id: ascensionid, billingid,
               collectionEndDate: report.samplingInformation.collectionEndDate,
               resultEntryEnd: report.samplingInformation.resultEntryEnd,
          } : null,
          referrerFacility: report.referrerFacility ? { facility_name: report.referrerFacility.facility_name } : null,
          validators: (report.validators || []).map(validator => ({ username: validator.username, employeeid: validator.employeeid })),
          resultentry: report.resultentry, enteredOn: report.enteredOn, lastupdatedon: report.lastupdatedon,
          logourl: report.logourl,
     };
}

export class PatientPortalResultService {
     constructor(private readonly tenantId: number) { }

     /** All of a patient's tests with the release decision applied; values are never included here. */
     async listTests(patientid: number, options: { billingid?: number; ascensionId?: number; from?: string; to?: string; limit?: number | null } = {}) {
          const range = portalResultDateRange(options.from, options.to);
          const connection = await bootstrapPatientPortal(this.tenantId);
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          const query = this.ownedAscensions(connection, patientid)
               .select(
                    'ta.id as ascensionid', 'ta.testid', 'ta.billingid', 'tp.name as testname', 'b.billedon',
                    'ta.collectionStartDate', 'ta.processingStartDate', 'ta.resultEntryEnd', 'ds.paymentstatus',
               )
               .orderBy('ta.id', 'desc');
          // Lists are capped for display; summaries pass limit: null so counts cover every test.
          if (options.limit !== null) query.limit(options.limit ?? 500);
          if (options.billingid) query.andWhere('ta.billingid', options.billingid);
          if (options.ascensionId) query.andWhere('ta.id', options.ascensionId);
          if (range.from && range.to) query.whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [range.from, range.to]);
          const rows: any[] = await query;
          if (!rows.length) return [];

          const ids = rows.map(row => Number(row.ascensionid));
          const [approvals, releases] = await Promise.all([
               connection('dbotestresultapproval').select('ascensionid', 'isapproved', 'approvedBy', 'minvalidation', 'requires_revalidation', 'lastupdatedon', connection.raw("EXISTS(SELECT 1 FROM lab_critical_events ce WHERE ce.ascensionid = dbotestresultapproval.ascensionid AND ce.resolved_at IS NULL AND JSON_EXTRACT(ce.policy_snapshot, '$.hold_release') = true) as critical_release_hold")).whereIn('ascensionid', ids),
               connection('patient_portal_result_releases').select('ascension_id', 'status', 'decided_at').whereIn('ascension_id', ids),
          ]);
          const approvalBy = new Map(approvals.map((row: any) => [Number(row.ascensionid), row]));
          const releaseBy = new Map(releases.map((row: any) => [Number(row.ascension_id), row]));

          return rows.map(row => {
               const approval: any = approvalBy.get(Number(row.ascensionid)) || null;
               const release: any = releaseBy.get(Number(row.ascensionid)) || null;
               const decision = evaluateResultRelease({ ...row, approval, release }, settings);
               return {
                    ascensionid: Number(row.ascensionid),
                    testid: Number(row.testid),
                    billingid: Number(row.billingid),
                    testname: row.testname || 'Laboratory test',
                    requestedOn: row.billedon,
                    stage: decision.stage,
                    released: decision.released,
                    pending: decision.pending,
                    completedOn: decision.released ? (release?.decided_at || approval?.lastupdatedon || row.resultEntryEnd) : null,
               };
          });
     }

     /** Joins only tests on bills that belong to this patient; cancelled or voided items never appear. */
     private ownedAscensions(connection: Knex, patientid: number) {
          return connection('test_ascension as ta')
               .join('billing as b', 'b.billingid', 'ta.billingid')
               .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
               .leftJoin('dboservices as ds', 'ds.serviceid', 'ta.serviceid')
               .where('b.patientid', patientid)
               .andWhere(q => q.whereNull('b.status').orWhereNot('b.status', 'voided'))
               .andWhere(q => q.whereNull('ds.status').orWhereNotIn('ds.status', ['cancelled', 'voided', 'refunded']))
               .andWhere(q => q.whereNull('ds.isDeleted').orWhere('ds.isDeleted', 0));
     }

     /** Builds the patient report for one bill containing only released results. */
     async getReport(patientid: number, billingid: number) {
          const tests = (await this.listTests(patientid, { billingid })).filter(test => test.released);
          if (!tests.length) throw new PatientPortalError('No released results are available for this request', 404, 'NOT_FOUND');

          const seen = new Set<number>();
          const reportTests = [];
          const reports = [];
          for (const test of tests) {
               if (seen.has(test.testid)) continue;
               seen.add(test.testid);
               const report = await loadReleasedLaboratoryReport(this.tenantId, patientid, billingid, test.testid, test.ascensionid, true, 'release');
               const safe = toExternalLaboratoryReport(report, test.ascensionid, billingid, patientid);
               const records = safe.records;
               reports.push(safe);
               reportTests.push({
                    ascensionid: test.ascensionid,
                    testname: report.testname || test.testname,
                    completedOn: test.completedOn,
                    records: records.map(record => ({ ...record, unit: record.units })),
                    drugs: (report.drugList || []).map(drug => ({ name: drug.drug, sensitivity: drug.sensitivity })),
                    comments: typeof report.comments === 'string' ? report.comments : '',
               });
          }
          if (!reportTests.length) throw new PatientPortalError('No released results are available for this request', 404, 'NOT_FOUND');

          const connection = await bootstrapPatientPortal(this.tenantId);
          const patient = await connection('new_patients')
               .select('fullpatientid', 'designation', 'firstname', 'middlename', 'lastname', 'gender', 'age', 'agetype', 'dob')
               .where({ patientid }).first();
          const company = await getAllCompanyProfiles(this.tenantId);
          return {
               billingid,
               patient,
               company: company ? {
                    name: company.name, address: (company as any).address, phonenumber: (company as any).phonenumber,
                    email: company.email, website: (company as any).website, motto: company.motto,
               } : null,
               tests: reportTests,
               reports,
               generatedAt: new Date(),
          };
     }

     // ---- Staff release controls ---------------------------------------------------------

     async setRelease(ascensionId: number, status: 'released' | 'withdrawn', staffId: number, reason?: string) {
          const connection = await bootstrapPatientPortal(this.tenantId);
          const ascension = await connection('test_ascension as ta')
               .join('billing as b', 'b.billingid', 'ta.billingid')
               .select('ta.id', 'b.patientid').where('ta.id', ascensionId).first();
          if (!ascension) throw new PatientPortalError('Test not found', 404, 'NOT_FOUND');
          await connection('patient_portal_result_releases')
               .insert({ ascension_id: ascensionId, status, decided_by: staffId, reason: reason ? String(reason).slice(0, 500) : null, decided_at: new Date() })
               .onConflict('ascension_id').merge(['status', 'decided_by', 'reason', 'decided_at']);
          return { ascensionId, patientid: Number(ascension.patientid), status };
     }

     async getReleaseStatus(ascensionIds: number[]) {
          if (!ascensionIds.length) return [];
          const connection = await bootstrapPatientPortal(this.tenantId);
          return connection('patient_portal_result_releases')
               .select('ascension_id', 'status', 'decided_by', 'reason', 'decided_at').whereIn('ascension_id', ascensionIds);
     }
}
