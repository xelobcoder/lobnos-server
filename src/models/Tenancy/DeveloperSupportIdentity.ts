import { randomBytes, randomInt } from "crypto";
import type { Knex } from "knex";
import { isSuperAdminRole } from "../../middleware/roles";
import { FacilityError } from "./FacilityInput";
import { DEVELOPER_SUPPORT_EMAIL } from "./DeveloperSessionPolicy";

export async function ensureSupportColumn(db: Knex) {
     if (await db.schema.hasColumn("roles", "platform_support")) return;
     try {
          await db.schema.alterTable("roles", (table) =>
               table.boolean("platform_support").notNullable().defaultTo(false),
          );
     } catch (error: any) {
          if (error.code !== "ER_DUP_FIELDNAME") throw error;
     }
}

export async function ensureDeveloperSupportIdentity(trx: Knex.Transaction) {
     // The branch lock serializes first-use identity creation across backend processes.
     const branch = await trx("branch")
          .where({ activation: 1 })
          .orderBy("branchid", "asc")
          .forUpdate()
          .first("branchid");
     if (!branch)
          throw new FacilityError(
               "This facility has no active branch. Configure a branch before opening its workspace.",
               409,
          );
     let row = await trx("roles").where({ email: DEVELOPER_SUPPORT_EMAIL }).forUpdate().first();
     if (!row) {
          const [employeeid] = await trx("roles").insert({
               username: "Platform Developer",
               firstname: "Platform Developer",
               email: DEVELOPER_SUPPORT_EMAIL,
               role: "super_admin",
               activation: 1,
               branch: branch.branchid,
               platform_support: true,
               emailAuthenticated: "true",
               mobile: String(randomInt(1000000000, 2000000000)),
               password: "disabled:" + randomBytes(32).toString("hex"),
          });
          row = await trx("roles").where({ employeeid }).first();
     }
     if (Number(row?.platform_support) !== 1 || !isSuperAdminRole(row.role) || Number(row.activation) !== 1) {
          throw new FacilityError("The developer identity for this facility needs repair", 409);
     }
     if (Number(row.branch) !== Number(branch.branchid)) {
          await trx("roles").where({ employeeid: row.employeeid }).update({ branch: branch.branchid });
     }
     return row;
}
