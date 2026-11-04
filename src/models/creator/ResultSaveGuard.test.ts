import { beforeEach, describe, expect, it, vi } from "vitest";
import { transactionalDatabase } from "../../testSupport/transactionalDatabase";
import { decrypt_value } from "../../utils/encryptionModels";

const mocks = vi.hoisted(() => ({
     workflow: vi.fn().mockResolvedValue(undefined),
     qc: vi.fn().mockResolvedValue(undefined),
     window: vi.fn().mockResolvedValue(true),
     critical: vi.fn().mockResolvedValue(undefined),
     analytics: vi.fn().mockResolvedValue(undefined),
     calculatedAudit: vi.fn().mockResolvedValue(undefined),
     bypass: vi.fn().mockResolvedValue(undefined),
     imaging: vi.fn().mockResolvedValue(false),
     imagingAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../database/KnexConnections", () => ({ default: vi.fn() }));
vi.mock("../operations/LaboratoryWorkflow", () => ({
     LaboratoryWorkflowService: class {
          requireResultEntry = mocks.workflow;
     },
}));
vi.mock("./calculations/QCEnforcementService", () => ({ requireDailyQcAcceptance: mocks.qc }));
vi.mock("../security/RequestAcessResult/requestAcess", () => ({ default: { verifyWindowPeriod: mocks.window } }));
vi.mock("../settings/users/RolesRepository", () => ({
     default: class {
          getEmployeeRole = async () => "scientist";
     },
}));
vi.mock("../operations/CriticalActionService", () => ({ evaluateCriticalActions: mocks.critical }));
vi.mock("../operations/imaging/ImagingResultAuditRepository", () => ({
     default: {
          isImagingTest: mocks.imaging,
          ensureTable: async () => undefined,
          decryptStoredValue: (value: string) => value,
          diffFields: () => [{ fieldName: "10", oldValue: null, newValue: "7", action: "CREATE" }],
          record: mocks.imagingAudit,
     },
}));
vi.mock("./calculations/CalculationFormulaService", () => ({
     CalculationFormulaService: class {
          prepareResultEntry = async (_tenant: any, _test: any, _ascension: any, fields: any[]) => ({
               fields,
               auditRecords: [],
          });
          recordCalculatedResults = mocks.calculatedAudit;
     },
}));
vi.mock("../result-value-analytics/ResultValueAnalyticsService", () => ({
     ResultValueAnalyticsService: { processCommittedResultEntry: mocks.analytics },
}));
vi.mock("../result-value-analytics/TestAnalyticsPreComputeService", () => ({
     TestAnalyticsPreComputeService: { recomputeTestAnalytics: mocks.analytics },
}));
vi.mock("../operations/ascension", () => ({
     TestAscension: class {
          static systemLaboratoryByPass = mocks.bypass;
          static async updateSampleAscensionstate(
               _tenant: number,
               ascensionid: number,
               stage: string,
               value: any,
               _actor: number,
               trx: any,
          ) {
               await trx("test_ascension")
                    .where({ id: ascensionid })
                    .update({ [stage]: value });
          }
          static async incrementTestEditCount(_tenant: number, billingid: number, ascensionid: number, trx: any) {
               if (!trx) throw new Error("Counter write escaped result transaction");
               await trx("save_count_events").insert({ billingid, ascensionid });
          }
     },
}));
import KnexConnection from "../../database/KnexConnections";
import Creator from "./creator";
import { validateResultFields } from "./ResultSaveGuard";

const field = (fieldid = 10, value = "7") => ({ fieldid, field: "Synthetic parameter", value, originalvalue: value });
const request = (extra: any = {}) => ({
     csvid: "x".repeat(70) + "2",
     ptid: "x".repeat(50) + "5",
     testid: 3,
     ascensionid: 1,
     employeeid: 9,
     comments: "",
     fields: [field()],
     hasDrugs: false,
     drugs: [],
     ...extra,
});
function setup(extra: Record<string, any[]> = {}) {
     const store = transactionalDatabase({
          test_ascension: [
               { id: 1, testid: 3, billingid: 2 },
               { id: 4, testid: 3, billingid: 2 },
          ],
          billing: [{ billingid: 2, patientid: 5, branchid: 6 }],
          test_panels: [{ id: 3 }],
          testcreationrules: [
               { id: 10, testid: 3 },
               { id: 11, testid: 3 },
          ],
          dbotestresultapproval: [1, 4].map((ascensionid) => ({
               ascensionid,
               approval_revision: 0,
               approvedBy: "8",
               isapproved: 1,
               requires_revalidation: 0,
          })),
          lab_result_approval_events: [{ ascensionid: 1, revision: 0, employeeid: 8 }],
          test_results_audit_log: [{ id: 100, ascensionid: 1, value: "historical synthetic ciphertext" }],
          ...extra,
     });
     // Outside-transaction preflight reads only; all mutations use the transactional adapter.
     const db: any = (table: string) => {
          let filters: any = {};
          const query: any = {
               where(value: any) {
                    filters = { ...filters, ...value };
                    return query;
               },
               first: async () =>
                    store
                         .rows(table)
                         .find((row) => Object.entries(filters).every(([key, value]) => row[key] === value)),
          };
          return query;
     };
     db.transaction = store.db.transaction;
     vi.mocked(KnexConnection).mockResolvedValue(db);
     vi.spyOn(Creator.prototype, "canPrintResult").mockResolvedValue(true);
     const save = async (data = request(), tenant = 1) => {
          const creator = new Creator(3);
          await creator.resultEntry(tenant, data as any);
          return { changed: creator.resultSaveChanged, replayed: creator.resultSaveReplayed };
     };
     return { store, save, db };
}
beforeEach(() => {
     vi.restoreAllMocks();
     vi.clearAllMocks();
     mocks.window.mockResolvedValue(true);
     mocks.workflow.mockResolvedValue(undefined);
     mocks.qc.mockResolvedValue(undefined);
     mocks.imaging.mockResolvedValue(false);
     mocks.critical.mockResolvedValue(undefined);
});

describe("laboratory result save retry integrity (real Creator write path)", () => {
     it("fails closed with an actionable schema error and no writes when retry storage is missing", async () => {
          const { save, store, db } = setup();
          db.transaction = (callback: (trx: any) => unknown) =>
               store.db.transaction((trx) => {
                    const guarded = (table: string) => {
                         if (table !== "lab_result_save_requests") return trx(table);
                         const query = {
                              where: () => query,
                              first: async () => {
                                   throw Object.assign(new Error("Missing table"), { code: "ER_NO_SUCH_TABLE" });
                              },
                         };
                         return query;
                    };
                    return callback(guarded);
               });
          await expect(save(request({ request_id: "retry-operation-0001" }))).rejects.toMatchObject({
               statusCode: 503,
               code: "RESULT_SAVE_SCHEMA_REQUIRED",
               message: expect.stringContaining("No changes were saved"),
          });
          expect(store.rows("test_results")).toEqual([]);
          expect(store.rows("result_comments")).toEqual([]);
          expect(store.rows("save_count_events")).toEqual([]);
          expect(mocks.critical).not.toHaveBeenCalled();
          expect(mocks.analytics).not.toHaveBeenCalled();
     });
     it("demonstrates the previous parallel check-then-insert duplicate symptom inside one transaction", async () => {
          const { store } = setup();
          await store.db.transaction(async (trx) => {
               await trx("test_ascension").where({ id: 1 }).forUpdate().first();
               await Promise.all(
                    [field(), field()].map(async (item) => {
                         const key = { ascensionid: 1, testid: 3, fieldid: item.fieldid };
                         const prior = await trx("test_results").where(key).first();
                         if (!prior) await trx("test_results").insert({ ...key, value: item.value });
                    }),
               );
          });
          expect(store.rows("test_results")).toHaveLength(2);
     });
     it("reproduces and rejects the same-parameter fan-out payload instead of silently deduplicating values", async () => {
          const { save, store } = setup();
          await expect(save(request({ fields: [field(), field()] }))).rejects.toThrow("Repeated result parameter");
          await expect(save(request({ fields: [field(), field(10, "8")] }))).rejects.toThrow(
               "Repeated result parameter",
          );
          expect(store.rows("test_results")).toEqual([]);
          expect(store.rows("lab_work_actions")).toEqual([]);
          expect(() => validateResultFields([field(0)])).toThrow("valid field ID");
     });
     it("commits simultaneous network retries once, including revisions, counters, critical and analytics side effects", async () => {
          const { save, store } = setup();
          const data = request({ request_id: "retry-operation-0001" });
          const outcomes = await Promise.all([save(data), save(data), save(data)]);
          expect(outcomes.filter((row) => row.changed)).toHaveLength(1);
          expect(outcomes.filter((row) => row.replayed)).toHaveLength(2);
          expect(store.rows("test_results")).toHaveLength(1);
          expect(store.rows("result_comments")).toHaveLength(1);
          expect(store.rows("save_count_events")).toHaveLength(1);
          expect(store.rows("lab_work_actions")).toHaveLength(1);
          expect(store.rows("lab_result_save_requests")).toHaveLength(1);
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({
               approval_revision: 1,
               approvedBy: null,
               requires_revalidation: 1,
          });
          expect(mocks.critical).toHaveBeenCalledTimes(1);
          expect(mocks.calculatedAudit).toHaveBeenCalledTimes(1);
          expect(mocks.bypass).toHaveBeenCalledTimes(1);
     });
     it("protects identical saves from separate tabs or older clients without a shared request ID", async () => {
          const { save, store } = setup();
          await Promise.all([save(), save(), save(request({ request_id: "other-tab-save-0001" }))]);
          expect(store.rows("test_results")).toHaveLength(1);
          expect(store.rows("lab_work_actions")).toHaveLength(1);
          // An unchanged save after review does not invalidate approval again.
          await store.db.transaction(async (trx) => {
               await trx("test_ascension").forUpdate().first();
               await trx("dbotestresultapproval")
                    .where({ ascensionid: 1 })
                    .update({ isapproved: 1, approvedBy: "8", requires_revalidation: 0 });
          });
          expect(await save()).toEqual({ changed: false, replayed: false });
          expect(store.rows("dbotestresultapproval")[0].approvedBy).toBe("8");
     });
     it("does not reapply a delayed retry over a later clinical edit, but permits deliberate reversion with a new identity", async () => {
          const { save, store } = setup();
          const original = request({ request_id: "original-save-0001" });
          await save(original);
          await save(request({ request_id: "clinical-edit-0001", fields: [field(10, "9")] }));
          expect(await save(original)).toEqual({ changed: false, replayed: true });
          expect(decrypt_value(store.rows("test_results")[0].value)).toBe("9");
          await save(request({ request_id: "deliberate-revert-01" }));
          expect(decrypt_value(store.rows("test_results")[0].value)).toBe("7");
          expect(store.rows("lab_work_actions")).toHaveLength(3);
          expect(store.rows("lab_result_approval_events")).toHaveLength(1);
          expect(store.rows("test_results_audit_log")).toHaveLength(1);
     });
     it("preserves same-name parameters, partial updates, and repeat ordered tests", async () => {
          const { save, store } = setup();
          await save(request({ fields: [field(), field(11)] }));
          await save(request({ fields: [field(11, "11")] }));
          await save(request({ ascensionid: 4, fields: [field(), field(11)] }));
          expect(store.rows("test_results")).toHaveLength(4);
          expect(
               decrypt_value(
                    store.rows("test_results").find((row) => row.ascensionid === 1 && row.fieldid === 10).value,
               ),
          ).toBe("7");
          expect(store.rows("lab_work_actions")).toHaveLength(3);
     });
     it("preserves and idempotently resaves blank text, numeric zero and independent original values", async () => {
          const { save, store } = setup();
          const data = request({
               fields: [
                    { ...field(), value: "", originalvalue: "synthetic original" },
                    { ...field(11, "0"), originalvalue: 0 },
               ],
          });
          await save(data);
          const rows = store.rows("test_results");
          expect(rows[0].value).toBe("");
          expect(rows[0].originalvalue).not.toBe("synthetic original");
          expect(decrypt_value(rows[0].originalvalue)).toBe("synthetic original");
          expect(decrypt_value(rows[1].value)).toBe("0");
          expect(await save(data)).toEqual({ changed: false, replayed: false });
          await save(request({ fields: [field(10, "")] }));
          expect(await save(request({ fields: [field(10, "")] }))).toEqual({ changed: false, replayed: false });
     });
     it("blocks existing ambiguous current rows without updating or deleting any clinical history", async () => {
          const rows = [1, 2].map((id) => ({
               id,
               ascensionid: 1,
               testid: 3,
               fieldid: 10,
               billingid: 2,
               patientid: 5,
               value: "not read",
          }));
          const { save, store } = setup({ test_results: rows });
          await expect(save()).rejects.toThrow("reviewed repair");
          expect(store.rows("test_results")).toEqual(rows);
          expect(store.rows("test_results_audit_log")).toHaveLength(1);
          expect(store.rows("lab_work_actions")).toEqual([]);
     });
     it("rejects request-ID reuse, changed ownership, foreign parameters, and stale revisions", async () => {
          const { save, store } = setup();
          const original = request({ request_id: "original-save-0001" });
          await save(original);
          await expect(save(request({ ...original, employeeid: 12 }))).rejects.toThrow("different operation");
          await expect(save(request({ ...original, fields: [field(10, "8")] }))).rejects.toThrow("different operation");
          await expect(save(request({ ptid: "x".repeat(50) + "99" }))).rejects.toThrow("does not belong");
          await expect(save(request({ fields: [field(99)] }))).rejects.toThrow("does not belong");
          await expect(save(request({ fields: [field(10, "8")], expected_revision: 0 }))).rejects.toThrow("Reload");
          expect(store.rows("lab_work_actions")).toHaveLength(1);
     });
     it("retains workflow, QC and access-window checks and rolls back revisions on failed edits", async () => {
          const { save, store } = setup();
          await save();
          mocks.window.mockResolvedValue(false);
          await expect(save(request({ fields: [field(10, "8")] }))).rejects.toThrow("Edit window");
          expect(store.rows("lab_work_actions")).toHaveLength(1);
          expect(store.rows("dbotestresultapproval")[0].approval_revision).toBe(1);
          mocks.workflow.mockRejectedValueOnce(new Error("Sample rejected"));
          await expect(save()).rejects.toThrow("Sample rejected");
          mocks.qc.mockRejectedValueOnce(new Error("QC Required"));
          await expect(save()).rejects.toThrow("QC Required");
     });
     it("does not duplicate the imaging audit on retry", async () => {
          const { save, store } = setup();
          mocks.imaging.mockResolvedValue(true);
          const data = request({ request_id: "imaging-save-000001", isScan: true });
          await Promise.all([save(data), save(data)]);
          await save(request({ isScan: true }));
          expect(mocks.imagingAudit).toHaveBeenCalledTimes(1);
          expect(store.rows("lab_work_actions")).toHaveLength(1);
     });
     it("rolls back results, revision, counter and receipt on downstream failure, then accepts the same retry once", async () => {
          const { save, store } = setup();
          const data = request({ request_id: "failed-save-retry-01" });
          mocks.critical.mockRejectedValueOnce(new Error("Synthetic critical action failure"));
          await expect(save(data)).rejects.toThrow("critical action failure");
          expect(store.rows("test_results")).toEqual([]);
          expect(store.rows("save_count_events")).toEqual([]);
          expect(store.rows("lab_work_actions")).toEqual([]);
          expect(store.rows("lab_result_save_requests")).toEqual([]);
          expect(store.rows("dbotestresultapproval")[0].approval_revision).toBe(0);
          await save(data);
          await save(data);
          expect(store.rows("test_results")).toHaveLength(1);
          expect(store.rows("lab_work_actions")).toHaveLength(1);
     });
     it("saves culture/sensitivity edits but not identical drug retries, and rejects ambiguous drug identities", async () => {
          const { save, store } = setup();
          const data = request({ hasDrugs: true, drugs: [{ id: 20, sensitivity: "Sensitive" }] });
          await save(data);
          expect(await save(data)).toEqual({ changed: false, replayed: false });
          await save(request({ hasDrugs: true, drugs: [{ id: 20, sensitivity: "Resistant" }] }));
          expect(store.rows("resultentrydrugsreaction")).toHaveLength(1);
          expect(store.rows("resultentrydrugsreaction")[0].reaction).toBe("Resistant");
          expect(store.rows("lab_work_actions")).toHaveLength(2);
          await expect(save(request({ hasDrugs: true, drugs: [{ id: 20 }, { id: 20 }] }))).rejects.toThrow(
               "drug result identity",
          );
     });
     it("does not silently overwrite duplicate comments or duplicate drug rows during a clinical edit", async () => {
          for (const extra of [
               {
                    result_comments: [
                         { billingid: 2, testid: 3, comments: "one" },
                         { billingid: 2, testid: 3, comments: "two" },
                    ],
               },
               {
                    resultentrydrugsreaction: [
                         { ascensionid: 1, testid: 3, drugid: 20 },
                         { ascensionid: 1, testid: 3, drugid: 20 },
                    ],
               },
          ]) {
               const { save, store } = setup(extra);
               await expect(save()).rejects.toThrow("reviewed repair");
               expect(store.rows("test_results")).toEqual([]);
               expect(store.rows("lab_work_actions")).toEqual([]);
          }
     });
     it("routes each tenant to its own connection and never replays another tenant’s receipt", async () => {
          const one = setup();
          const two = setup();
          vi.mocked(KnexConnection).mockImplementation(async (tenant) => (tenant === 1 ? one.db : two.db));
          const data = request({ request_id: "same-id-two-tenants" });
          await one.save(data, 1);
          await two.save(data, 2);
          expect(one.store.rows("test_results")).toHaveLength(1);
          expect(two.store.rows("test_results")).toHaveLength(1);
          expect(two.store.rows("lab_work_actions")).toHaveLength(1);
     });
});
