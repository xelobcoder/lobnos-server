import KnexConnection from "../../../database/KnexConnections";
import { encrypt_value, decrypt_value } from "../../../utils/encryptionModels";

/**
 * Per-tenant audit trail for imaging (ultrasound / radiology) result changes.
 *
 * Old/new values are clinical data. They are stored AES-encrypted with the same helper
 * that protects `test_results.value` and are only decrypted when an authorised admin reads the trail.
 */

export const IMAGING_AUDIT_TABLE = "imaging_result_audit_log";

export type ImagingAuditAction = "CREATE" | "UPDATE" | "DELETE" | "FINALIZE";
export type ImagingAuditEntity = "RESULT_FIELD" | "CLINICAL_HISTORY" | "IMAGE" | "APPROVAL";

export interface ImagingAuditEntry {
     ascensionid: number;
     testid?: number | null;
     patientid?: number | null;
     billingid?: number | null;
     entityType: ImagingAuditEntity;
     entityId?: string | number | null;
     action: ImagingAuditAction;
     fieldName: string;
     oldValue?: string | null;
     newValue?: string | null;
     employeeid?: number | null;
}

export interface ImagingAuditFilters {
     ascensionid?: number;
     employeeid?: number;
     action?: ImagingAuditAction;
     startDate?: string;
     endDate?: string;
     page?: number;
     count?: number;
}

/** Department-name fragments (case-insensitive) that classify a department as imaging. Shared by audit + analytics. */
export const IMAGING_DEPARTMENT_KEYWORDS = ["ultrasound", "sonograph", "radiolog", "x-ray", "xray", "imaging", "mri", "mammogra", "ct scan", "ct-scan", "computed tomography"];

export function imagingDepartmentCondition(column: string): { sql: string; bindings: string[] } {
     const sql = "(" + IMAGING_DEPARTMENT_KEYWORDS.map(() => `LOWER(${column}) LIKE ?`).join(" OR ") + ")";
     return { sql, bindings: IMAGING_DEPARTMENT_KEYWORDS.map((keyword) => `%${keyword}%`) };
}

export function ultrasoundDepartmentCondition(column: string): { sql: string; bindings: string[] } {
     return {
          sql: `(LOWER(${column}) LIKE ? OR LOWER(${column}) LIKE ?)`,
          bindings: ["%ultrasound%", "%sonograph%"],
     };
}

export async function createImagingAuditTable(knex: any): Promise<void> {
     if (await knex.schema.hasTable(IMAGING_AUDIT_TABLE)) return;
     await knex.schema.createTable(IMAGING_AUDIT_TABLE, (table: any) => {
          table.bigIncrements("id").primary();
          table.integer("ascensionid").unsigned().notNullable();
          table.integer("testid").unsigned().nullable();
          table.integer("patientid").unsigned().nullable();
          table.integer("billingid").unsigned().nullable();
          table.string("entity_type", 32).notNullable();
          table.string("entity_id", 64).nullable();
          table.string("action", 16).notNullable();
          table.string("field_name", 190).notNullable();
          table.specificType("old_value", "LONGTEXT").nullable();
          table.specificType("new_value", "LONGTEXT").nullable();
          table.integer("employeeid").unsigned().nullable();
          table.specificType("created_at", "DATETIME(6)").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP(6)"));
          table.index(["ascensionid", "created_at"], "idx_imaging_audit_case");
          table.index(["employeeid", "created_at"], "idx_imaging_audit_user");
          table.index(["created_at"], "idx_imaging_audit_date");
     });
}

const ensuredTenants = new Set<number>();

const normalise = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

function safeDecrypt(value: unknown): string | null {
     if (value === null || value === undefined) return null;
     try {
          return decrypt_value(String(value));
     } catch {
          return "[unreadable]";
     }
}

export default class ImagingResultAuditRepository {
     /**
      * Idempotent. DDL implicitly commits in MySQL, so callers MUST run this before opening their own transaction.
      */
     static async ensureTable(tenantId: number): Promise<void> {
          if (ensuredTenants.has(tenantId)) return;
          const knex = await KnexConnection(tenantId);
          try {
               await createImagingAuditTable(knex);
          } catch (error: any) {
               // Concurrent first-use from two requests: the other one won the race.
               if (error?.code !== "ER_TABLE_EXISTS_ERROR") throw error;
          }
          ensuredTenants.add(tenantId);
     }

     /** Test helper. */
     static resetEnsureCache(): void {
          ensuredTenants.clear();
     }

     /** Plain old/new maps (keyed by field) -> list of create/update changes. Unchanged fields are dropped. */
     static diffFields(
          oldValues: Record<string, string | null | undefined>,
          newValues: Record<string, string | null | undefined>
     ): Array<{ fieldName: string; action: "CREATE" | "UPDATE"; oldValue: string | null; newValue: string | null }> {
          const changes: Array<{ fieldName: string; action: "CREATE" | "UPDATE"; oldValue: string | null; newValue: string | null }> = [];
          for (const fieldName of Object.keys(newValues)) {
               const hasOld = Object.prototype.hasOwnProperty.call(oldValues, fieldName);
               const before = hasOld ? normalise(oldValues[fieldName]) : "";
               const after = normalise(newValues[fieldName]);
               if (hasOld && before === after) continue;
               if (!hasOld && after === "") continue;
               changes.push({
                    fieldName,
                    action: hasOld ? "UPDATE" : "CREATE",
                    oldValue: hasOld ? before : null,
                    newValue: after,
               });
          }
          return changes;
     }

     /** Decrypts a stored result value; legacy/plain values fall back to the raw string. */
     static decryptStoredValue(value: unknown): string {
          if (value === null || value === undefined || value === "") return "";
          try {
               return decrypt_value(String(value));
          } catch {
               return String(value);
          }
     }

     /** Writes audit rows with the caller's transaction (or a plain connection) so they commit/rollback together with the change. */
     static async record(db: any, entries: ImagingAuditEntry[]): Promise<void> {
          if (!entries.length) return;
          await db(IMAGING_AUDIT_TABLE).insert(
               entries.map((entry) => ({
                    ascensionid: entry.ascensionid,
                    testid: entry.testid ?? null,
                    patientid: entry.patientid ?? null,
                    billingid: entry.billingid ?? null,
                    entity_type: entry.entityType,
                    entity_id: entry.entityId === null || entry.entityId === undefined ? null : String(entry.entityId),
                    action: entry.action,
                    field_name: entry.fieldName.slice(0, 190),
                    old_value: entry.oldValue === null || entry.oldValue === undefined ? null : encrypt_value(entry.oldValue) || "",
                    new_value: entry.newValue === null || entry.newValue === undefined ? null : encrypt_value(entry.newValue) || "",
                    employeeid: entry.employeeid ?? null,
               }))
          );
     }

     static async isImagingTest(db: any, testid: number): Promise<boolean> {
          const condition = imagingDepartmentCondition("dp.department");
          const row = await db("test_panels as tp")
               .innerJoin("departments as dp", "dp.id", "tp.category")
               .where("tp.id", testid)
               .whereRaw(condition.sql, condition.bindings)
               .first("tp.id");
          return Boolean(row);
     }

     static async isUltrasoundTest(db: any, testid: number): Promise<boolean> {
          const condition = ultrasoundDepartmentCondition("dp.department");
          const row = await db("test_panels as tp")
               .innerJoin("departments as dp", "dp.id", "tp.category")
               .where("tp.id", testid)
               .whereRaw(condition.sql, condition.bindings)
               .first("tp.id");
          return Boolean(row);
     }

     static async isResultAuthor(db: any, ascensionid: number, testid: number, employeeid: number): Promise<boolean> {
          const row = await db("test_results").where({ ascensionid, testid, employeeid }).first("employeeid");
          return Boolean(row);
     }

     static async query(tenantId: number, filters: ImagingAuditFilters) {
          await this.ensureTable(tenantId);
          const knex = await KnexConnection(tenantId);
          const page = Math.max(1, Math.floor(filters.page || 1));
          const count = Math.min(200, Math.max(1, Math.floor(filters.count || 50)));

          const apply = (builder: any) => {
               if (filters.ascensionid) builder.where("a.ascensionid", filters.ascensionid);
               if (filters.employeeid) builder.where("a.employeeid", filters.employeeid);
               if (filters.action) builder.where("a.action", filters.action);
               if (filters.startDate) builder.where("a.created_at", ">=", `${filters.startDate} 00:00:00`);
               if (filters.endDate) builder.whereRaw("a.created_at < DATE_ADD(?, INTERVAL 1 DAY)", [filters.endDate]);
               return builder;
          };

          const totalRow = await apply(knex(`${IMAGING_AUDIT_TABLE} as a`)).count({ total: "*" }).first();
          const rows = await apply(knex(`${IMAGING_AUDIT_TABLE} as a`))
               .leftJoin("roles as r", "r.employeeid", "a.employeeid")
               .select(
                    "a.id", "a.ascensionid", "a.testid", "a.patientid", "a.billingid", "a.entity_type", "a.entity_id",
                    "a.action", "a.field_name", "a.old_value", "a.new_value", "a.employeeid", "a.created_at",
                    "r.username as employee_name"
               )
               .orderBy("a.id", "desc")
               .limit(count)
               .offset((page - 1) * count);

          return {
               page,
               count,
               total: Number((totalRow as any)?.total || 0),
               rows: rows.map((row: any) => ({
                    id: row.id,
                    ascensionid: row.ascensionid,
                    testid: row.testid,
                    patientid: row.patientid,
                    billingid: row.billingid,
                    entityType: row.entity_type,
                    entityId: row.entity_id,
                    action: row.action,
                    fieldName: row.field_name,
                    oldValue: safeDecrypt(row.old_value),
                    newValue: safeDecrypt(row.new_value),
                    employeeid: row.employeeid,
                    employeeName: row.employee_name ?? null,
                    createdAt: row.created_at,
               })),
          };
     }
}

/** Server-derived actor: verified token user when present, otherwise the employeeid the caller supplied. */
export function resolveActorEmployeeId(req: any): number | null {
     const raw = req?.authUser?.employeeid ?? req?.query?.employeeid ?? req?.body?.employeeid ?? req?.body?.employeeId;
     const parsed = Number(raw);
     return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
