import { Request, Response } from "express";
import { getTestTrends } from "../../models/creator/test-trends";

export async function getTestTrendsHandler(req: Request, res: Response) {
     try {
          const tenantId = parseInt(req.query.tenantId as string, 10);
          const patientid = Number(req.query.patientid || req.body.patientid);
          const testid = Number(req.query.testid || req.body.testid);
          const trendNumber = req.query.trendNumber ? Number(req.query.trendNumber) : 10;
          const limit = req.query.limit ? Number(req.query.limit) : 25;

          if (!tenantId || !patientid || !testid) {
               return res.status(400).json({ error: "tenantId, patientid, and testid are required" });
          }

          const data = await getTestTrends(tenantId, patientid, testid, trendNumber, limit);
          return res.json({ data });
     } catch (error) {
          console.error("Error in getTestTrendsHandler:", error);
          return res.status(500).json({ error: "Internal server error" });
     }
}
