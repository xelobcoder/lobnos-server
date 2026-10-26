import { describe, expect, it, vi } from "vitest";
import { transactionalDatabase } from "../../testSupport/transactionalDatabase";
vi.mock("./LabAccessPolicy", async (actual) => ({ ...(await actual<any>()), assertLabTestAccess: vi.fn() }));
import { OutsourceAssignmentService } from "./OutsourceAssignmentService";
import { assertLabTestAccess } from "./LabAccessPolicy";
const actor: any = { employeeid: 7, tenantId: 1, branch: 4, role: "scientist" };
function fixture(state = "awaiting_dispatch", hasCase = true) {
     const store = transactionalDatabase({
          dboservices: [{ serviceid: 2, isoutsourced: 1, outsourceid: hasCase ? 6 : null, outsourceprice: 10 }],
          outsourcedtesttracking: hasCase
               ? [{ id: 3, serviceid: 2, testid: 5, outsourceid: 6, workflow_status: state, workflow_version: 1 }]
               : [],
          lab_outsource_providers: [{ testid: 5, outsourceid: 8, cost: 15, currency: "GHS", active: true }],
     });
     const service = new OutsourceAssignmentService(store.db);
     vi.spyOn(service, "context").mockResolvedValue({ serviceid: 2, testid: 5, organizations: [{ outsourceid: 8 }] });
     return { service, store };
}
const input = { outsourceid: 8, expectedOutsourceid: 6, version: 1, reason: "Receiving laboratory changed" };
describe("receiving laboratory assignment", () => {
     it("updates the service and pending case together and records an audit without collecting a sample", async () => {
          const { service, store } = fixture();
          await service.assign(actor, 10, input);
          expect(store.rows("dboservices")[0]).toMatchObject({ outsourceid: 8, outsourceprice: 15 });
          expect(store.rows("outsourcedtesttracking")[0]).toMatchObject({
               outsourceid: 8,
               workflow_version: 2,
               snapshot_cost: 15,
          });
          expect(store.rows("lab_control_audit")).toHaveLength(1);
          expect(store.rows("physical_samples")).toHaveLength(0);
     });
     it("creates a pending case for a billed test whose organization was not known when billed", async () => {
          const { service, store } = fixture("awaiting_dispatch", false);
          await service.assign(actor, 10, { ...input, expectedOutsourceid: null, version: null });
          expect(store.rows("outsourcedtesttracking")).toHaveLength(1);
          expect(store.rows("outsourcedtesttracking")[0]).toMatchObject({
               outsourceid: 8,
               workflow_status: "awaiting_dispatch",
               workflow_version: 1,
          });
     });
     it("rejects stale assignments and case versions without partially updating the service", async () => {
          const { service, store } = fixture();
          await expect(service.assign(actor, 10, { ...input, expectedOutsourceid: 9 })).rejects.toThrow("changed");
          await expect(service.assign(actor, 10, { ...input, version: 2 })).rejects.toThrow("changed");
          expect(store.rows("dboservices")[0].outsourceid).toBe(6);
     });
     it.each(["sent", "awaiting_results", "returned", "completed", "cancelled"])(
          "preserves the receiving laboratory after %s",
          async (status) => {
               const { service, store } = fixture(status);
               await expect(service.assign(actor, 10, input)).rejects.toThrow("cannot change");
               expect(store.rows("dboservices")[0].outsourceid).toBe(6);
          },
     );
     it("refuses a provider not configured for the test", async () => {
          const { service } = fixture();
          await expect(service.assign(actor, 10, { ...input, outsourceid: 99 })).rejects.toThrow("configured");
     });
     it("requires edit access before changing an assignment", async () => {
          const { service, store } = fixture();
          vi.mocked(assertLabTestAccess).mockRejectedValueOnce(
               Object.assign(Error("Assigned to another scientist"), { statusCode: 403 }),
          );
          await expect(service.assign(actor, 10, input)).rejects.toThrow("another scientist");
          expect(store.events).toHaveLength(0);
          expect(store.rows("dboservices")[0].outsourceid).toBe(6);
     });
});
