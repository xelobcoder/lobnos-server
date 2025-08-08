import { Request, Response } from "express";
import TestResultsAuditLogRepository from "./testResultsAuditLogs";

export class TestResultsAuditLogsController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new TestResultsAuditLogRepository(tenantId);
               const id = await repo.create(req.body);
               res.status(201).json({ id });
          } catch (error) {
               res.status(500).json({ error: "Failed to create audit log", details: error.message });
          }
     }

     static async getById(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new TestResultsAuditLogRepository(tenantId);
               const log = await repo.findById(Number(req.params.id));
               if (!log) return res.status(404).json({ error: "Not found" });
               res.json(log);
          } catch (error) {
               res.status(500).json({ error: "Failed to fetch audit log", details: error.message });
          }
     }

     static async listPaginated(req: Request, res: Response) {
          try {
               const tenantIdNum = Number(req.query.tenantId);
               const pageNum = Number(req.query.page) || 1;
               const pageSizeNum = Number(req.query.pageSize) || 20;
               // Extract filters from query (excluding pagination and tenantId)
               const { page, pageSize, tenantId, ...filters } = req.query;
               const repo = new TestResultsAuditLogRepository(tenantIdNum);
               const result = await repo.findAllPaginated(pageNum, pageSizeNum, filters);
               res.json(result);
          } catch (error) {
               res.status(500).json({ error: "Failed to fetch paginated audit logs", details: error.message });
          }
     }

     static async listAll(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new TestResultsAuditLogRepository(tenantId);
               const logs = await repo.findAll();
               res.json(logs);
          } catch (error) {
               res.status(500).json({ error: "Failed to fetch audit logs", details: error.message });
          }
     }

     static async delete(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new TestResultsAuditLogRepository(tenantId);
               const deleted = await repo.delete(Number(req.params.id));
               res.json({ deleted });
          } catch (error) {
               res.status(500).json({ error: "Failed to delete audit log", details: error.message });
          }
     }
}
