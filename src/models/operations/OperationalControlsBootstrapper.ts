import type { Knex } from "knex";
import KnexConnection from "../../database/KnexConnections";

export async function ensureOperationalControls(db: Knex) {
     if (
          (await db.schema.hasTable("test_panels")) &&
          !(await db.schema.hasColumn("test_panels", "lab_outsource_version"))
     )
          await db.schema.alterTable("test_panels", (t) =>
               t.integer("lab_outsource_version").notNullable().defaultTo(0),
          );
     if (!(await db.schema.hasTable("lab_access_settings")))
          await db.schema.createTable("lab_access_settings", (t) => {
               t.integer("id").primary();
               t.string("visibility", 20).notNullable().defaultTo("team");
               t.string("editing", 20).notNullable().defaultTo("team");
               t.boolean("allow_claim").notNullable().defaultTo(false);
               t.boolean("allow_sonographer_amendment_signing").notNullable().defaultTo(false);
               t.boolean("require_amendment_signoff").notNullable().defaultTo(true);
               t.integer("version").notNullable().defaultTo(1);
               t.integer("updated_by").nullable();
               t.datetime("updated_at").nullable();
          });
     if (!(await db.schema.hasColumn("lab_access_settings", "allow_sonographer_amendment_signing")))
          await db.schema.alterTable("lab_access_settings", (t) =>
               t.boolean("allow_sonographer_amendment_signing").notNullable().defaultTo(false),
          );
     if (!(await db.schema.hasColumn("lab_access_settings", "require_amendment_signoff")))
          await db.schema.alterTable("lab_access_settings", (t) =>
               t.boolean("require_amendment_signoff").notNullable().defaultTo(true),
          );
     await db("lab_access_settings").insert({ id: 1 }).onConflict("id").ignore();
     await db("lab_access_settings")
          .where({ id: 1, version: 1 })
          .whereIn("visibility", ["team", "restricted"])
          .whereIn("editing", ["team", "assigned"])
          .update({ visibility: "team", editing: "team", allow_claim: false });
     if (!(await db.schema.hasTable("lab_critical_policies")))
          await db.schema.createTable("lab_critical_policies", (t) => {
               t.integer("rule_id").unsigned().primary();
               t.integer("testid").unsigned().notNullable();
               t.json("actions").notNullable();
               t.integer("version").notNullable().defaultTo(1);
               t.integer("updated_by").notNullable();
               t.datetime("updated_at").notNullable();
          });
     if (!(await db.schema.hasTable("lab_critical_events")))
          await db.schema.createTable("lab_critical_events", (t) => {
               t.increments("id");
               t.integer("legacy_alert_id").unsigned().nullable().unique();
               t.integer("ascensionid").unsigned().nullable();
               t.integer("testid").unsigned().notNullable();
               t.integer("billingid").unsigned().notNullable();
               t.integer("revision").unsigned().nullable();
               t.integer("rule_id").unsigned().nullable();
               t.text("statement").notNullable();
               t.json("policy_snapshot").notNullable();
               t.datetime("created_at").notNullable();
               t.integer("created_by").unsigned().notNullable();
               t.datetime("acknowledged_at").nullable();
               t.integer("acknowledged_by").unsigned().nullable();
               t.datetime("communicated_at").nullable();
               t.integer("communicated_by").unsigned().nullable();
               t.text("communication").nullable();
               t.datetime("resolved_at").nullable();
               t.integer("resolved_by").unsigned().nullable();
               t.text("resolution").nullable();
               t.integer("version").notNullable().defaultTo(1);
               t.index(["ascensionid", "resolved_at"]);
               t.index(["created_at"]);
          });
     const escalationColumns = [
          "readback_due_at", "readback_confirmed_at", "readback_confirmed_by",
          "readback_recipient", "readback_details", "readback_escalated_at",
     ] as const;
     for (const column of escalationColumns) {
          if (await db.schema.hasColumn("lab_critical_events", column)) continue;
          await db.schema.alterTable("lab_critical_events", t => {
               if (column === "readback_confirmed_by") t.integer(column).unsigned().nullable();
               else if (column === "readback_recipient") t.string(column, 150).nullable();
               else if (column === "readback_details") t.text(column).nullable();
               else if (column === "readback_due_at") t.datetime(column).nullable().index();
               else t.datetime(column).nullable();
          });
     }
     if (!(await db.schema.hasTable("lab_control_audit")))
          await db.schema.createTable("lab_control_audit", (t) => {
               t.increments("id");
               t.string("entity", 30).notNullable();
               t.integer("entity_id").unsigned().notNullable();
               t.string("action", 40).notNullable();
               t.integer("employeeid").unsigned().notNullable();
               t.text("reason").notNullable();
               t.json("metadata").nullable();
               t.datetime("created_at").notNullable();
               t.index(["entity", "entity_id"]);
          });
     if (!(await db.schema.hasTable("lab_outsource_providers")))
          await db.schema.createTable("lab_outsource_providers", (t) => {
               t.increments("id");
               t.integer("testid").unsigned().notNullable();
               t.integer("outsourceid").unsigned().notNullable();
               t.decimal("cost", 15, 2).notNullable();
               t.string("currency", 3).notNullable().defaultTo("GHS");
               t.integer("tat_hours").unsigned().notNullable();
               t.boolean("preferred").notNullable().defaultTo(false);
               t.boolean("active").notNullable().defaultTo(true);
               t.date("effective_from").notNullable();
               t.date("effective_to").nullable();
               t.integer("version").notNullable().defaultTo(1);
               t.integer("updated_by").unsigned().notNullable();
               t.datetime("updated_at").notNullable();
               t.unique(["testid", "outsourceid"]);
          });
     if (await db.schema.hasTable("outsourcedtesttracking")) {
          const columns: Record<string, (t: Knex.AlterTableBuilder) => void> = {
               workflow_status: (t) => t.string("workflow_status", 30).nullable(),
               workflow_version: (t) => t.integer("workflow_version").notNullable().defaultTo(1),
               snapshot_cost: (t) => t.decimal("snapshot_cost", 15, 2).nullable(),
               snapshot_currency: (t) => t.string("snapshot_currency", 3).nullable(),
               due_at: (t) => t.datetime("due_at").nullable(),
               dispatched_at: (t) => t.datetime("dispatched_at").nullable(),
               external_reference: (t) => t.string("external_reference", 150).nullable(),
               assigned_employeeid: (t) => t.integer("assigned_employeeid").unsigned().nullable(),
          };
          for (const [name, add] of Object.entries(columns))
               if (!(await db.schema.hasColumn("outsourcedtesttracking", name)))
                    await db.schema.alterTable("outsourcedtesttracking", add);
          await db("outsourcedtesttracking")
               .whereNull("workflow_status")
               .update({ workflow_status: db.raw("CASE WHEN status = 1 THEN 'completed' ELSE 'legacy_pending' END") });
     }
     if (!(await db.schema.hasTable("lab_outsource_reports")))
          await db.schema.createTable("lab_outsource_reports", (t) => {
               t.increments("id");
               t.integer("tracking_id").unsigned().notNullable();
               t.string("filename", 180).notNullable();
               t.string("mime", 60).notNullable();
               t.specificType("content", "LONGBLOB").notNullable();
               t.string("sha256", 64).notNullable();
               t.integer("uploaded_by").unsigned().notNullable();
               t.datetime("uploaded_at").notNullable();
               t.index("tracking_id");
          });
     // Import legacy alerts as alert-only history; no retrospective release holds or invented communication.
     if (await db.schema.hasTable("loggingcriticalvaluealert"))
          await db.raw(`INSERT IGNORE INTO lab_critical_events
          (legacy_alert_id, ascensionid, testid, billingid, statement, policy_snapshot, created_at, created_by, acknowledged_at, acknowledged_by)
          SELECT a.crkeyId, a.ascensionid, a.testid, a.billingid, a.statement, JSON_OBJECT(), a.createdOn, COALESCE(a.createdBy, 0),
          NULL, CASE WHEN a.isSeen = 1 THEN a.isSeenBy ELSE NULL END
          FROM loggingcriticalvaluealert a WHERE a.billingid IS NOT NULL AND a.testid IS NOT NULL`);
}
export async function bootstrapOperationalControls(tenantId: number) {
     await ensureOperationalControls(await KnexConnection(tenantId));
}
