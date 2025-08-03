import { Request, Response } from "express";
import { OutsourcedTestTrackingRepo } from "../../models/operations/OutsourcedTestTrackingRepo";

export class OutsourcedTestTrackingController {
     static async getProfitPerTestByOutsource(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const outsourceid = req.query.outsourceid ? Number(req.query.outsourceid) : undefined;
               const repo = new OutsourcedTestTrackingRepo(tenantId);
               const result = await repo.getProfitPerTestByOutsource(outsourceid);
               res.json(result);
          } catch (error) {
               res.status(500).json({ error: error.message });
          }
     }

     static async getProfitByOutsourcedTest(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const outsourceid = req.query.outsourceid ? Number(req.query.outsourceid) : undefined;
               const repo = new OutsourcedTestTrackingRepo(tenantId);
               const result = await repo.getProfitByOutsourcedTest(outsourceid);
               res.json(result);
          } catch (error) {
               res.status(500).json({ error: error.message });
          }
     }

     static async getOursourcedCases(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const page = parseInt(req.query.page as string, 10) || 1;
               const count = parseInt(req.query.count as string, 10) || 10;
               const sortby = req.query.sortby as 'ASC' | 'DESC' || 'DESC';
               const repo = new OutsourcedTestTrackingRepo(tenantId);
               const result = await repo.getOursourcedTestCasesPaginated(page, count, sortby);
               res.json(result);
          }
          catch (error) {
               res.status(500).json({ error: error.message });
          }
     }

     static async getOutsourcedCasesProfit(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const outsourceid = req.query.outsourceid ? Number(req.query.outsourceid) : undefined;
               const testid = req.query.testid ? Number(req.query.testid) : undefined;
               const repo = new OutsourcedTestTrackingRepo(tenantId);
               const result = await repo.getProfitByOutsourcedTest(outsourceid,testid);
               res.json(result);
          } catch (error) {
               res.status(500).json({ error: error.message });
          }
     }
}
