import { describe, expect, it } from "vitest";
import type { Knex } from "knex";
import { ensureDeveloperSupportIdentity } from "./DeveloperSupportIdentity";
import { DEVELOPER_SUPPORT_EMAIL } from "./DeveloperSessionPolicy";

function createTransaction(existingRole?: string) {
     let inserted: Record<string, unknown> | undefined;
     let queryConditions: Record<string, unknown> = {};
     const transaction = ((table: string) => {
          queryConditions = {};
          const query: any = {
               where: (conditions: Record<string, unknown>) => {
                    queryConditions = conditions;
                    return query;
               },
               orderBy: () => query,
               forUpdate: () => query,
               first: async () => {
                    if (table === "branch") return { branchid: 1 };
                    if ("email" in queryConditions) {
                         return existingRole
                              ? { employeeid: 7, email: DEVELOPER_SUPPORT_EMAIL, platform_support: 1, role: existingRole, activation: 1, branch: 1 }
                              : undefined;
                    }
                    return inserted ? { ...inserted, employeeid: 7 } : undefined;
               },
               insert: async (values: Record<string, unknown>) => {
                    inserted = values;
                    return [7];
               },
          };
          return query;
     }) as unknown as Knex.Transaction;

     return { transaction, inserted: () => inserted };
}

describe("developer support identity", () => {
     it("uses the supported super_admin enum value when creating the identity", async () => {
          const fixture = createTransaction();

          const identity = await ensureDeveloperSupportIdentity(fixture.transaction);

          expect(fixture.inserted()).toMatchObject({
               email: DEVELOPER_SUPPORT_EMAIL,
               role: "super_admin",
               platform_support: true,
          });
          expect(identity.employeeid).toBe(7);
     });

     it("accepts existing super-admin role spellings", async () => {
          const fixture = createTransaction("super-admin");

          const identity = await ensureDeveloperSupportIdentity(fixture.transaction);

          expect(identity.employeeid).toBe(7);
          expect(fixture.inserted()).toBeUndefined();
     });
});
