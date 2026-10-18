import { Knex } from 'knex';
import Creator from '../creator/creator';
import ResultPrint from '../result/resultPrint';
import { TestAscension } from '../operations/ascension';
import { getAllCompanyProfiles } from '../settings/companyProfile';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettings, PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientPortalError } from './PatientPortalAccountService';

export type PatientResultStage = 'registered' | 'collected' | 'processing' | 'completed' | 'verified';

export interface ResultReleaseInput {
     collectionStartDate?: unknown;
     processingStartDate?: unknown;
     resultEntryEnd?: unknown;
     paymentstatus?: string | null;
     approval?: { isapproved?: unknown; approvedBy?: unknown; minvalidation?: unknown } | null;
     release?: { status?: string } | null;
}

export interface ResultReleaseDecision {
     stage: PatientResultStage;
     released: boolean;
     /** Patient-facing explanation for results that are not yet available. */
     pending: 'in_progress' | 'awaiting_verification' | 'awaiting_payment' | 'awaiting_release' | null;
}

/** Mirrors ResultSettings.isApprovalLimitReached(..., 'minimum') without a query per test. */
export function isResultApproved(approval: ResultReleaseInput['approval']): boolean {
     if (!approval) return false;
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

export class PatientPortalResultService {
     constructor(private readonly tenantId: number) { }

     /** All of a patient's tests with the release decision applied; values are never included here. */
     async listTests(patientid: number, options: { billingid?: number; ascensionId?: number } = {}) {
          const connection = await bootstrapPatientPortal(this.tenantId);
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          const query = this.ownedAscensions(connection, patientid)
               .select(
                    'ta.id as ascensionid', 'ta.testid', 'ta.billingid', 'tp.name as testname', 'b.billedon',
                    'ta.collectionStartDate', 'ta.processingStartDate', 'ta.resultEntryEnd', 'ds.paymentstatus',
               )
               .orderBy('ta.id', 'desc').limit(500);
          if (options.billingid) query.andWhere('ta.billingid', options.billingid);
          if (options.ascensionId) query.andWhere('ta.id', options.ascensionId);
          const rows: any[] = await query;
          if (!rows.length) return [];

          const ids = rows.map(row => Number(row.ascensionid));
          const [approvals, releases] = await Promise.all([
               connection('dbotestresultapproval').select('ascensionid', 'isapproved', 'approvedBy', 'minvalidation', 'lastupdatedon').whereIn('ascensionid', ids),
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

          const creator = new Creator(0);
          const seen = new Set<number>();
          const reportTests = [];
          for (const test of tests) {
               if (seen.has(test.testid)) continue;
               seen.add(test.testid);
               const view: any = await new Creator(test.testid).resultPresentationView(this.tenantId, test.testid, billingid, patientid);
               if (!view || typeof view === 'string') continue;
               const records = Array.isArray(view.result) ? await ResultPrint.decryptResultArray(view.result) : [];
               let drugs: any[] = [];
               if (view.hasDrugs) {
                    const saved = await TestAscension.getAscensionSavedDrugs(this.tenantId, test.ascensionid, test.testid);
                    drugs = Array.isArray(saved) ? saved.filter((drug: any) => ['Resistant', 'Sensitive'].includes(drug.sensitivity)) : [];
               }
               const comments = await creator.getCustomCommentsRecords(this.tenantId, billingid, test.testid);
               reportTests.push({
                    ascensionid: test.ascensionid,
                    testname: view.testname || test.testname,
                    completedOn: test.completedOn,
                    records: (records || []).map((record: any) => ({
                         name: record.name ?? record.field ?? record.parameter ?? '',
                         value: record.value ?? '',
                         unit: record.unit ?? record.units ?? '',
                         lowerlimit: record.lowerlimit ?? null,
                         upperlimit: record.upperlimit ?? null,
                         flag: record.flag ?? record.indicator ?? null,
                    })),
                    drugs: drugs.map((drug: any) => ({ name: drug.name ?? drug.drugname ?? drug.drug ?? '', sensitivity: drug.sensitivity })),
                    comments: typeof comments === 'string' ? comments : '',
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
