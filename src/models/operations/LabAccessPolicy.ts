import type { AuthUser } from "../../middleware/authority";
import { roleAllowed } from "../../middleware/roles";
import ResultSettings from "../application/appsettings/result-settings/resultSettings";

export const controlsFail = (message: string, statusCode = 400): never => {
     throw Object.assign(new Error(message), { statusCode });
};
export const labSupervisor = (actor: { role: string }) => roleAllowed(actor.role, ["admin", "manager"]);
export async function labAccessSettings(db: any) {
     return (
          (await db("lab_access_settings").where({ id: 1 }).first()) || {
               visibility: "team",
               editing: "team",
               allow_claim: false,
               allow_sonographer_amendment_signing: false,
               version: 1,
          }
     );
}
export async function assertLabTestAccess(
     db: any,
     actor: AuthUser,
     ascensionid: number,
     editing = false,
     validator = false,
) {
     const test = await db("test_ascension as ta")
          .join("billing as bill", "bill.billingid", "ta.billingid")
          .leftJoin("lab_work_assignments as work", "work.ascensionid", "ta.id")
          .where("ta.id", ascensionid)
          .select("ta.id", "bill.branchid", "work.assigned_employeeid")
          .first();
     if (!test || (actor.branch != null && Number(test.branchid) !== Number(actor.branch)))
          return controlsFail("Ordered test is outside your branch", 404);
     if (labSupervisor(actor) || !roleAllowed(actor.role, ["scientist"])) return;
     if (actor.branch == null) return controlsFail("An operating branch is required", 403);
     const settings = await labAccessSettings(db);
     if (editing ? settings.editing !== "assigned" : settings.visibility !== "restricted") return;
     const assigned = Number(test.assigned_employeeid) === Number(actor.employeeid);
     // Qualified reviewers retain the minimum read access needed to validate independently.
     const reviewer =
          !editing && (validator || (await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid)));
     if (editing && settings?.editing === "assigned" && !assigned)
          return controlsFail("Claim this test or ask a supervisor to assign it before editing results", 403);
     if (
          !editing &&
          settings?.visibility === "restricted" &&
          !assigned &&
          !reviewer &&
          !(settings?.allow_claim && !test.assigned_employeeid)
     )
          return controlsFail("This test is assigned to another scientist", 403);
}
export async function scopeLabWork(query: any, db: any, actor: AuthUser, ascensionColumn: string, editing = false) {
     if (labSupervisor(actor) || !roleAllowed(actor.role, ["scientist"])) return;
     const settings = await labAccessSettings(db);
     if (editing ? settings?.editing !== "assigned" : settings?.visibility !== "restricted") return;
     if (!editing && (await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid))) return;
     query.where(function (this: any) {
          this.whereExists(function (this: any) {
               this.select(db.raw("1"))
                    .from("lab_work_assignments as permission")
                    .whereRaw("permission.ascensionid = ??", [ascensionColumn])
                    .where("permission.assigned_employeeid", actor.employeeid);
          });
          if (!editing && settings?.allow_claim)
               this.orWhereNotExists(function (this: any) {
                    this.select(db.raw("1"))
                         .from("lab_work_assignments as claimed")
                         .whereRaw("claimed.ascensionid = ??", [ascensionColumn])
                         .whereNotNull("claimed.assigned_employeeid");
               });
     });
}
