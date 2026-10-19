import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { loadLaboratoryReportData } from '../result/LaboratoryReportData';
import { isResultApproved, toExternalLaboratoryReport } from '../patient-portal/PatientPortalResultService';

export class ClinicianPortalError extends Error {
     constructor(message: string, public statusCode = 400, public code = 'INVALID_REQUEST') { super(message); }
}

export interface ClinicianScopeUser {
     role?: string;
     employeeid?: number;
     clinicianid?: number;
}

/** Roles that authenticate outside the facility's staff directory and must never pick a clinician. */
const EXTERNAL_ROLES = ['patient', 'organization', 'outsourced'];

const positiveId = (value: unknown): number | null => {
     if (value === undefined || value === null || value === '') return null;
     const text = String(value);
     if (!/^\d+$/.test(text)) return NaN;
     const id = Number(text);
     return Number.isSafeInteger(id) && id > 0 ? id : NaN;
};

/**
 * Decides which clinician's requests the caller may read. A clinician session is always bound to
 * its own identity; a requested id that differs is refused rather than silently replaced. Facility
 * staff (who can already open every result) may preview a named clinician's portal.
 */
export function resolveClinicianScope(user: ClinicianScopeUser | null | undefined, requested: unknown): number {
     if (!user) throw new ClinicianPortalError('Authentication required', 401, 'UNAUTHENTICATED');
     const role = String(user.role || '').toLowerCase().trim();
     const requestedId = positiveId(requested);
     if (Number.isNaN(requestedId)) throw new ClinicianPortalError('A valid clinician id is required', 400);

     if (role === 'clinician') {
          const own = Number(user.clinicianid ?? user.employeeid);
          if (!Number.isSafeInteger(own) || own <= 0) throw new ClinicianPortalError('Authentication required', 401, 'UNAUTHENTICATED');
          if (requestedId !== null && requestedId !== own) {
               throw new ClinicianPortalError('You may only view requests you made', 403, 'FORBIDDEN');
          }
          return own;
     }
     if (!role || EXTERNAL_ROLES.includes(role)) {
          throw new ClinicianPortalError('You are not authorized to view clinician requests', 403, 'FORBIDDEN');
     }
     if (requestedId === null) throw new ClinicianPortalError('A valid clinician id is required', 400);
     return requestedId;
}

export function clinicianDateRange(from: unknown, to: unknown): { from: string; to: string } {
     const valid = (value: unknown): value is string => typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value;
     if (!valid(from) || !valid(to) || from > to) {
          throw new ClinicianPortalError('Provide a valid start and end date, with the start no later than the end.', 400);
     }
     return { from, to };
}

type StageStatus = 'completed' | 'bypassed' | 'in_progress' | 'pending' | 'rejected';

export interface ClinicianPortalDeps {
     connection: () => Promise<Knex>;
     /** The clinician's live services on the bill, with the bill's patient. Empty when not owned. */
     findOwnedServices: (clinicianid: number, billingid: number) => Promise<{ serviceid: number; patientid: number }[]>;
     loadStages: (billingid: number) => Promise<any[]>;
     loadReport: (patientid: number, billingid: number, testid: number, ascensionid: number) => ReturnType<typeof loadLaboratoryReportData>;
}

const liveService = (q: Knex.QueryBuilder) => q
     .andWhere(w => w.whereNull('b.status').orWhereNot('b.status', 'voided'))
     .andWhere(w => w.whereNull('ds.status').orWhereNotIn('ds.status', ['cancelled', 'voided', 'refunded']))
     .andWhere(w => w.whereNull('ds.isDeleted').orWhere('ds.isDeleted', 0));

export function defaultClinicianPortalDeps(tenantId: number): ClinicianPortalDeps {
     const connection = () => KnexConnection(tenantId) as Promise<Knex>;
     return {
          connection,
          findOwnedServices: async (clinicianid, billingid) => {
               const db = await connection();
               const rows: any[] = await liveService(db('dboservices as ds')
                    .join('billing as b', 'b.billingid', 'ds.billingid')
                    .where('ds.billingid', billingid)
                    .andWhere('ds.clinicianId', clinicianid))
                    .select('ds.serviceid', 'b.patientid');
               return rows.map(row => ({ serviceid: Number(row.serviceid), patientid: Number(row.patientid) }));
          },
          loadStages: async billingid => {
               // Loaded lazily: operations.ts and testApprovalClass.ts import each other.
               const { default: Operations } = await import('../operations/operations');
               return Operations.getAscensionOverViewModelTransaction(tenantId, billingid);
          },
          loadReport: (patientid, billingid, testid, ascensionid) =>
               loadLaboratoryReportData(tenantId, patientid, billingid, testid, ascensionid, true),
     };
}

const workflowStatus = (value: unknown, done: unknown, started?: unknown): StageStatus => {
     if (done) return 'completed';
     if (value === 'completed' || value === 'bypassed') return value;
     return started ? 'in_progress' : 'pending';
};

/** Shapes one test's journey for the clinician; staff usernames are shown, contacts never are. */
export function describeTestStages(row: any) {
     const workflow = row.workflow || {};
     const approved = !!row.resultEntryEnd && isResultApproved(row);
     const rejected = !!row.rejectionmessage || Number(row.isRedraw) === 1;
     const timeline = [
          { key: 'requested', label: 'Requested', status: 'completed' as StageStatus, at: row.ascension_date || null },
          {
               key: 'collection', label: 'Sample collected', at: row.collectionEndDate || null, startedAt: row.collectionStartDate || null,
               by: row.collected_by_name || null, status: workflowStatus(workflow.collection, row.collectionEndDate, row.collectionStartDate),
          },
          {
               key: 'received', label: 'Sample received & validated', at: row.samplevalidatedon || null,
               status: rejected ? 'rejected' as StageStatus : workflowStatus(workflow.sampleValidation, Number(row.approvalstatus) === 1 && row.samplevalidatedon),
               note: rejected ? (row.rejectionmessage || 'Recollection requested') : null,
          },
          {
               key: 'processing', label: 'Processing', at: row.processingEndDate || null, startedAt: row.processingStartDate || null,
               by: row.processed_by_name || null, status: workflowStatus(workflow.processing, row.processingEndDate, row.processingStartDate),
          },
          {
               key: 'result_entry', label: 'Result entered', at: row.resultEntryEnd || null, startedAt: row.resultEntryStart || null,
               by: row.result_entered_by_name || null, status: workflowStatus(null, row.resultEntryEnd, row.resultEntryStart),
          },
          {
               key: 'validation', label: 'Validated / approved', at: approved ? (row.lastupdatedon || null) : null,
               status: approved ? 'completed' as StageStatus : (row.resultEntryEnd ? 'in_progress' as StageStatus : 'pending' as StageStatus),
          },
          {
               key: 'release', label: 'Released / delivered', at: row.delivered_at || null,
               by: row.delivered_by_name || null, mode: row.delivered_mode || row.requested_mode || null,
               status: row.delivered_at ? 'completed' as StageStatus : 'pending' as StageStatus,
          },
     ];
     return {
          ascensionid: Number(row.ascension_id),
          testid: Number(row.testid),
          testname: row.test_name || 'Laboratory test',
          current_stage: approved ? 'Approved' : row.current_stage || 'Pending',
          sample_validation_stage: row.sample_validation_stage || null,
          result_validation_stage: row.result_validation_stage || null,
          blockedReason: approved || row.resultEntryEnd ? null : workflow.blockedReason || null,
          approved,
          reportUnavailable: false,
          timeline,
     };
}

const stageLabel = (row: any): string => {
     if (row.resultEntryEnd && isResultApproved(row)) return 'Approved';
     if (row.resultEntryEnd) return 'Completed';
     if (row.processingEndDate) return 'Processing Done';
     if (row.processingStartDate) return 'Processing';
     if (row.collectionEndDate) return 'Collected';
     if (row.collectionStartDate) return 'Collection Started';
     return 'Pending';
};

export class ClinicianPortalResultService {
     private readonly deps: ClinicianPortalDeps;

     constructor(private readonly tenantId: number, deps?: Partial<ClinicianPortalDeps>) {
          this.deps = { ...defaultClinicianPortalDeps(tenantId), ...(deps || {}) };
     }

     /** Bills on which this clinician ordered at least one test, grouped for the requested-tests list. */
     async listRequests(clinicianid: number, from: string, to: string) {
          const db = await this.deps.connection();
          const rows: any[] = await liveService(db('test_ascension as ta')
               .join('dboservices as ds', 'ds.serviceid', 'ta.serviceid')
               .join('billing as b', 'b.billingid', 'ta.billingid')
               .join('new_patients as p', 'p.patientid', 'b.patientid')
               .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
               .leftJoin('dbotestresultapproval as ra', 'ra.ascensionid', 'ta.id')
               .where('ds.clinicianId', clinicianid)
               .whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [from, to]))
               .select(
                    'ta.id as ascensionid', 'ta.testid', 'ta.billingid', 'ta.ascension_date', 'ta.collectionStartDate',
                    'ta.collectionEndDate', 'ta.processingStartDate', 'ta.processingEndDate', 'ta.resultEntryEnd',
                    'tp.name as testname', 'b.patientid', 'b.billedon', 'b.clientstatus as payment_status',
                    'p.fullpatientid', 'p.firstname', 'p.middlename', 'p.lastname', 'p.gender', 'p.age', 'p.agetype',
                    'ra.isapproved', 'ra.approvedBy', 'ra.minvalidation',
               )
               .orderBy('ta.billingid', 'desc').orderBy('ta.id', 'asc')
               .limit(5000);

          const bills = new Map<number, any>();
          for (const row of rows) {
               const billingid = Number(row.billingid);
               let bill = bills.get(billingid);
               if (!bill) {
                    bill = {
                         patientid: Number(row.patientid), billingid, billedon: row.billedon, payment_status: row.payment_status,
                         fullpatientid: row.fullpatientid, firstname: row.firstname, middlename: row.middlename, lastname: row.lastname,
                         patient_details: [row.fullpatientid, [row.firstname, row.lastname].filter(Boolean).join(' '), row.gender,
                              [row.age, row.agetype].filter(v => v !== null && v !== undefined && v !== '').join(' ')].filter(Boolean).join(' | '),
                         ascensionid: Number(row.ascensionid), ascension_date: row.ascension_date,
                         total_tests: 0, approved_tests: 0, tests: [] as any[],
                    };
                    bills.set(billingid, bill);
               }
               if (bill.tests.some((test: any) => test.ascensionid === Number(row.ascensionid))) continue;
               const stage = stageLabel(row);
               bill.tests.push({ ascensionid: Number(row.ascensionid), testid: Number(row.testid), testname: row.testname || `Test-${row.testid}`, stage });
               bill.total_tests += 1;
               if (stage === 'Approved') bill.approved_tests += 1;
               if (row.ascension_date && (!bill.ascension_date || new Date(row.ascension_date) < new Date(bill.ascension_date))) {
                    bill.ascension_date = row.ascension_date;
               }
          }
          return Array.from(bills.values()).map(bill => ({
               ...bill,
               approvalStatus: bill.total_tests > 0 && bill.approved_tests === bill.total_tests ? 1 : 0,
               tests_with_stage: bill.tests.map((test: any) => `${test.testname} (${test.stage})`).join(', '),
          }));
     }

     /** Stages for the clinician's tests on one bill, and full results for those already approved. */
     async getRequestResults(clinicianid: number, billingid: number) {
          const owned = await this.deps.findOwnedServices(clinicianid, billingid);
          // Not-owned and non-existent bills look the same so ids cannot be probed.
          if (!owned.length) throw new ClinicianPortalError('Request not found', 404, 'NOT_FOUND');
          const patientid = owned[0].patientid;
          const ownedServices = new Set(owned.map(service => Number(service.serviceid)));

          const stageRows = (await this.deps.loadStages(billingid)) || [];
          const seen = new Set<number>();
          const ownRows = stageRows.filter((row: any) => {
               const ascensionid = Number(row.ascension_id);
               if (!ownedServices.has(Number(row.serviceid)) || seen.has(ascensionid)) return false;
               seen.add(ascensionid);
               return true;
          });
          const tests = ownRows.map(describeTestStages);

          const reports: any[] = [];
          const loadedTests = new Set<number>();
          for (const test of tests) {
               if (!test.approved || loadedTests.has(test.testid)) continue;
               loadedTests.add(test.testid);
               try {
                    const report = await this.deps.loadReport(patientid, billingid, test.testid, test.ascensionid);
                    reports.push(toExternalLaboratoryReport(report, test.ascensionid, billingid, patientid));
               } catch {
                    test.reportUnavailable = true;
               }
          }

          const db = await this.deps.connection();
          const patient = await db('billing as b')
               .join('new_patients as p', 'p.patientid', 'b.patientid')
               .where('b.billingid', billingid)
               .select('p.patientid', 'p.fullpatientid', 'p.firstname', 'p.middlename', 'p.lastname', 'p.gender', 'p.age', 'p.agetype',
                    'b.billedon', 'b.clientstatus as payment_status')
               .first();

          return { billingid, patientid, patient: patient || null, tests, reports, generatedAt: new Date() };
     }
}
