import { Request, Response } from "express";
import ResultPrintingTrackingRepository from "../../models/operations/Repositories/ResultPrintingTrackingRepository";

export class ResultPrintingTrackingController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new ResultPrintingTrackingRepository(tenantId);
               const id = await repo.create(req.body);
               res.status(201).json({ status: id ? "success" : "error", id });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }


     static async getByAscensionId(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const ascensionid = Number(req.params.ascensionid);
               const repo = new ResultPrintingTrackingRepository(tenantId);
               const page = Number(req.query.page) || 1;
               const pageSize = Number(req.query.count) || 20;
               const sortby = req.query.sortby as 'ASC' | 'DESC';
               const result = await repo.findAllByAscensionId(ascensionid, page, pageSize, sortby);
               res.json(result);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async listAll(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new ResultPrintingTrackingRepository(tenantId);
               const page = Number(req.query.page) || 1;
               const pageSize = Number(req.query.count) || 20;
               const sortby = req.query.sortby as 'ASC' | 'DESC';
               const result = await repo.findAll(page, pageSize, sortby);
               res.json(result);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async delete(req: Request, res: Response) {
          try {
               const tenantId = Number(req.query.tenantId);
               const repo = new ResultPrintingTrackingRepository(tenantId);
               const deleted = await repo.delete(Number(req.params.id));
               res.json({ deleted });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}
