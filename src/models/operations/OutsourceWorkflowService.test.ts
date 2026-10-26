import { beforeEach, describe, expect, it, vi } from "vitest";
import { transactionalDatabase } from "../../testSupport/transactionalDatabase";
vi.mock("./LabAccessPolicy", async (importActual) => ({
     ...(await importActual<any>()),
     assertLabTestAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../services/cache/testPanelCache", () => ({
     testPanelCache: { invalidate: vi.fn().mockResolvedValue(undefined) },
}));
import { OutsourceWorkflowService } from "./OutsourceWorkflowService";
const admin: any = { employeeid: 8, tenantId: 1, branch: 4, role: "admin" };
const scientist: any = { ...admin, employeeid: 7, role: "scientist" };
const today = new Date().toISOString().slice(0, 10);
function fixture(extra: any = {}) {
     const store = transactionalDatabase({
          outsourcedtesttracking: [
               {
                    id: 1,
                    serviceid: 2,
                    testid: 5,
                    outsourceid: 6,
                    workflow_status: "awaiting_dispatch",
                    workflow_version: 1,
                    snapshot_cost: 20,
                    snapshot_currency: "GHS",
               },
          ],
          lab_outsource_providers: [
               {
                    id: 1,
                    testid: 5,
                    outsourceid: 6,
                    active: true,
                    cost: 99,
                    currency: "GHS",
                    tat_hours: 24,
                    effective_from: today,
                    version: 1,
               },
          ],
          ...extra,
     });
     const service = new OutsourceWorkflowService(store.db);
     vi.spyOn(service, "detail").mockResolvedValue({
          id: 1,
          ascensionid: 10,
          resultEntryEnd: new Date(),
          workflow_status: "awaiting_dispatch",
     });
     return { store, service };
}
beforeEach(() => vi.clearAllMocks());
describe("outsourcing workflow", () => {
     it("saves multiple organization services atomically while preserving other partners and case costs", async () => {
          const { service, store } = fixture({
               test_panels: [
                    { id: 5, lab_outsource_version: 0 },
                    { id: 8, lab_outsource_version: 0 },
               ],
               outsourcingorganization: [{ outsourceid: 6 }, { outsourceid: 7 }],
               lab_outsource_providers: [
                    {
                         testid: 5,
                         outsourceid: 7,
                         cost: 40,
                         currency: "GHS",
                         tat_hours: 48,
                         preferred: true,
                         active: true,
                         effective_from: today,
                         effective_to: null,
                    },
               ],
               testdetails: [{ testid: 5 }, { testid: 8 }],
          });
          const provider = {
               outsourceid: 6,
               cost: 20,
               currency: "GHS",
               tat_hours: 24,
               preferred: true,
               active: true,
               effective_from: today,
               effective_to: null,
          };
          await service.saveOrganizationServices(admin, 6, {
               reason: "Configure partner catalogue",
               services: [
                    { testid: 5, version: 0, provider },
                    { testid: 8, version: 0, provider: { ...provider, cost: 30 } },
               ],
          });
          expect(store.rows("lab_outsource_providers")).toEqual(
               expect.arrayContaining([
                    expect.objectContaining({ testid: 5, outsourceid: 7, active: true, preferred: false, cost: 40 }),
                    expect.objectContaining({ testid: 8, outsourceid: 6, cost: 30 }),
               ]),
          );
          expect(store.rows("test_panels").every((row) => row.lab_outsource_version === 1)).toBe(true);
          expect(store.rows("outsourcedtesttracking")[0].snapshot_cost).toBe(20);
     });
     it("rolls the entire organization catalogue save back if a later panel has changed", async () => {
          const { service, store } = fixture({
               test_panels: [
                    { id: 5, lab_outsource_version: 0 },
                    { id: 8, lab_outsource_version: 2 },
               ],
               outsourcingorganization: [{ outsourceid: 6 }],
               lab_outsource_providers: [],
          });
          const provider = {
               outsourceid: 6,
               cost: 20,
               tat_hours: 24,
               preferred: false,
               active: true,
               effective_from: today,
               effective_to: null,
          };
          await expect(
               service.saveOrganizationServices(admin, 6, {
                    reason: "Configure partner catalogue",
                    services: [
                         { testid: 5, version: 0, provider },
                         { testid: 8, version: 0, provider },
                    ],
               }),
          ).rejects.toThrow("changed");
          expect(store.rows("lab_outsource_providers")).toHaveLength(0);
          expect(store.rows("test_panels")[0].lab_outsource_version).toBe(0);
          expect(store.rows("lab_control_audit")).toHaveLength(0);
     });
     it("records dispatch and due dates without replacing the original agreed cost", async () => {
          const { store, service } = fixture();
          await service.transition(admin, 1, {
               status: "sent",
               version: 1,
               reason: "Specimen handed to courier",
               external_reference: "EXT-001",
          });
          expect(store.rows("outsourcedtesttracking")[0]).toMatchObject({
               snapshot_cost: 20,
               workflow_status: "sent",
               external_reference: "EXT-001",
               workflow_version: 2,
          });
          expect(store.rows("outsourcedtesttracking")[0].due_at).toBeInstanceOf(Date);
          expect(store.rows("lab_control_audit")).toHaveLength(1);
     });
     it("requires a valid provider and reference before dispatch", async () => {
          const { service } = fixture({ lab_outsource_providers: [] });
          await expect(
               service.transition(admin, 1, {
                    status: "sent",
                    version: 1,
                    reason: "Dispatch requested",
                    external_reference: "EXT",
               }),
          ).rejects.toThrow("valid provider");
          const valid = fixture();
          await expect(
               valid.service.transition(admin, 1, { status: "sent", version: 1, reason: "Dispatch requested" }),
          ).rejects.toThrow("reference");
     });
     it("does not mark an external report returned without its source document", async () => {
          const { service } = fixture({
               outsourcedtesttracking: [{ id: 1, workflow_status: "sent", workflow_version: 2 }],
          });
          await expect(
               service.transition(admin, 1, { status: "returned", version: 2, reason: "Results received" }),
          ).rejects.toThrow("Attach");
     });
     it("requires current validation and critical clearance before completion", async () => {
          const { store, service } = fixture({
               outsourcedtesttracking: [{ id: 1, workflow_status: "returned", workflow_version: 2 }],
               dbotestresultapproval: [{ ascensionid: 10, isapproved: 0 }],
          });
          await expect(
               service.transition(admin, 1, { status: "completed", version: 2, reason: "Review complete" }),
          ).rejects.toThrow("Validate");
          const held = fixture({
               outsourcedtesttracking: [{ id: 1, workflow_status: "returned", workflow_version: 2 }],
               dbotestresultapproval: [{ ascensionid: 10, isapproved: 1 }],
               lab_critical_events: [{ ascensionid: 10, policy_snapshot: '{"hold_release":true}' }],
          });
          await expect(
               held.service.transition(admin, 1, { status: "completed", version: 2, reason: "Review complete" }),
          ).rejects.toThrow("hold");
          expect(store.rows("lab_control_audit")).toHaveLength(0);
     });
     it("prevents stale transitions and non-supervisor cancellation", async () => {
          const { service } = fixture();
          await expect(
               service.transition(admin, 1, { status: "sent", version: 9, reason: "Stale dispatch" }),
          ).rejects.toThrow("changed");
          await expect(
               service.transition(scientist, 1, { status: "cancelled", version: 1, reason: "Cancel case" }),
          ).rejects.toThrow("supervisor");
     });
     it("supports removing every provider without changing historical case costs", async () => {
          const { store, service } = fixture({
               test_panels: [{ id: 5, lab_outsource_version: 1 }],
               testdetails: [{ testid: 5, OutSourcingList: "6" }],
          });
          await service.saveProviders(admin, 5, { providers: [], version: 1, reason: "Stop outsourcing this panel" });
          expect(store.rows("lab_outsource_providers")[0].active).toBe(false);
          expect(store.rows("testdetails")[0].OutSourcingList).toBe("");
          expect(store.rows("test_panels")[0].lab_outsource_version).toBe(2);
          expect(store.rows("outsourcedtesttracking")[0].snapshot_cost).toBe(20);
     });
     it("rejects negative costs, duplicate preferred partners and unauthorized provider changes", async () => {
          const { service } = fixture();
          const provider = {
               outsourceid: 6,
               cost: -1,
               tat_hours: 24,
               preferred: true,
               active: true,
               effective_from: today,
               effective_to: null,
          };
          await expect(
               service.saveProviders(admin, 5, { providers: [provider], version: 0, reason: "Set price" }),
          ).rejects.toThrow();
          await expect(
               service.saveProviders(admin, 5, {
                    providers: [
                         { ...provider, cost: 20 },
                         { ...provider, outsourceid: 7, cost: 30 },
                    ],
                    version: 0,
                    reason: "Set providers",
               }),
          ).rejects.toThrow("one active preferred");
          await expect(
               service.saveProviders(scientist, 5, { providers: [], version: 0, reason: "Remove providers" }),
          ).rejects.toThrow("supervisors");
     });
     it("rejects disguised non-PDF reports before writing an attachment", async () => {
          const { service, store } = fixture();
          await expect(
               service.upload(admin, 1, {
                    filename: "report.pdf",
                    base64: Buffer.from("<script>not a PDF</script>").toString("base64"),
               }),
          ).rejects.toThrow("PDF");
          expect(store.rows("lab_outsource_reports")).toHaveLength(0);
     });
});
