import { Request, Response } from "express";
import { ImagingAnalytics, ImagingBreakdown } from "../../models/operations/imaging/ImagingAnalytics";
import ImagingResultAuditRepository, { ImagingAuditAction } from "../../models/operations/imaging/ImagingResultAuditRepository";
import { roleAllowed } from "../../middleware/roles";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 732;
const AUDIT_ACTIONS: ImagingAuditAction[] = ["CREATE", "UPDATE", "DELETE", "FINALIZE"];

export function parseTenantId(value: unknown): number | null {
     const parsed = Number(value);
     return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseDate(value: unknown): string | null {
     if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
     const date = new Date(`${value}T00:00:00Z`);
     return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function validateDateRange(startRaw: unknown, endRaw: unknown): { startDate: string; endDate: string } | { error: string; code: string } {
     const startDate = parseDate(startRaw);
     const endDate = parseDate(endRaw);
     if (!startDate || !endDate) return { error: "startDate and endDate are required in YYYY-MM-DD format", code: "INVALID_DATE_FORMAT" };
     if (startDate > endDate) return { error: "startDate must be before or equal to endDate", code: "INVALID_DATE_RANGE" };
     const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000;
     if (days > MAX_RANGE_DAYS) return { error: `Date range may not exceed ${MAX_RANGE_DAYS} days`, code: "DATE_RANGE_TOO_LARGE" };
     return { startDate, endDate };
}

export default class ImagingAnalyticsController {
     /** GET /api/v1/operations/imaging/analytics?tenantId&startDate&endDate[&breakdown=modality,day] */
     public static async getImagingAnalytics(req: Request, res: Response): Promise<void> {
          const tenantId = parseTenantId(req.query.tenantId);
          if (!tenantId) {
               res.status(400).json({ error: "A valid numeric tenantId is required", code: "INVALID_TENANT_ID" });
               return;
          }
          const range = validateDateRange(req.query.startDate, req.query.endDate);
          if ("error" in range) {
               res.status(400).json(range);
               return;
          }
          const breakdowns = String(req.query.breakdown || "")
               .split(",")
               .map((item) => item.trim().toLowerCase())
               .filter((item): item is ImagingBreakdown => item === "modality" || item === "day");
          try {
               res.status(200).json(await ImagingAnalytics.getImagingAnalytics(tenantId, range.startDate, range.endDate, breakdowns));
          } catch (error) {
               console.error("Imaging analytics error:", error);
               res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
          }
     }
}

export class ImagingAuditController {
     /** Must run after checkTokenExists so req.authUser is token-derived (never the client-supplied employeeid). */
     public static requireAdmin(req: Request, res: Response, next: () => void): void {
          const role = String((req as any).authUser?.role || "").toLowerCase().trim().replace(/_/g, "-");
          if (!roleAllowed(role, ["admin"])) {
               res.status(403).json({ error: "Administrator access required", code: "FORBIDDEN" });
               return;
          }
          next();
     }

     /** GET /api/v1/operations/imaging/audit?tenantId[&ascensionid][&employeeid][&action][&startDate&endDate][&page][&count] */
     public static async list(req: Request, res: Response): Promise<void> {
          const tenantId = parseTenantId(req.query.tenantId);
          if (!tenantId) {
               res.status(400).json({ error: "A valid numeric tenantId is required", code: "INVALID_TENANT_ID" });
               return;
          }
          const filters: Parameters<typeof ImagingResultAuditRepository.query>[1] = {};

          if (req.query.ascensionid !== undefined) {
               const value = parseTenantId(req.query.ascensionid);
               if (!value) { res.status(400).json({ error: "Invalid ascensionid", code: "INVALID_FILTER" }); return; }
               filters.ascensionid = value;
          }
          if (req.query.filterEmployeeid !== undefined) {
               const value = parseTenantId(req.query.filterEmployeeid);
               if (!value) { res.status(400).json({ error: "Invalid filterEmployeeid", code: "INVALID_FILTER" }); return; }
               filters.employeeid = value;
          }
          if (req.query.action !== undefined) {
               const action = String(req.query.action).toUpperCase() as ImagingAuditAction;
               if (!AUDIT_ACTIONS.includes(action)) { res.status(400).json({ error: "Invalid action", code: "INVALID_FILTER" }); return; }
               filters.action = action;
          }
          if (req.query.startDate !== undefined || req.query.endDate !== undefined) {
               const range = validateDateRange(req.query.startDate, req.query.endDate);
               if ("error" in range) { res.status(400).json(range); return; }
               filters.startDate = range.startDate;
               filters.endDate = range.endDate;
          }
          const page = req.query.page === undefined ? 1 : Number(req.query.page);
          const count = req.query.count === undefined ? 50 : Number(req.query.count);
          if (!Number.isInteger(page) || page < 1 || !Number.isInteger(count) || count < 1) {
               res.status(400).json({ error: "page and count must be positive integers", code: "INVALID_PAGINATION" });
               return;
          }
          filters.page = page;
          filters.count = count;

          try {
               res.status(200).json(await ImagingResultAuditRepository.query(tenantId, filters));
          } catch (error) {
               console.error("Imaging audit query error:", error);
               res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
          }
     }
}
