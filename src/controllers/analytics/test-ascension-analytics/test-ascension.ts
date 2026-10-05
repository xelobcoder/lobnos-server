import TestAscensionTurnAroundTime from "../../../models/operations/TurnAroundTime";
import { Request, Response } from "express";
import { PENDING_RESULT_TAT_THRESHOLDS } from '../../../models/operations/pendingResultTATQueries';




export const getTatData = async (req: Request<{}, {}, {}, { page?: string, count?: string, tenantId: string, sortby?: string, sorting?: string, ascensionId?: string }>, res: Response<TatDataResponse>) => {
     const page = req.query.page ? parseInt(req.query.page) || 1 : 1;
     const count = req.query.count ? parseInt(req.query.count) || 10 : 10;
     const tenantId = parseInt(req.query.tenantId)
     const sorting = (req.query.sortby ?? req.query.sorting)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
     const ascensionId = req.query.ascensionId ? parseInt(req.query.ascensionId) : undefined;
     try {
          const data = await TestAscensionTurnAroundTime.getPaginatedTATData(tenantId, page, count, sorting, true, ascensionId);
          res.json({ success: true, data });
     } catch (error) {
          res.status(500).json({ success: false, message: "Internal server error" });
     }
};

export const getPendingResultTATSummary = async (req: Request, res: Response) => {
     const tenantId = parseInt(String(req.query.tenantId), 10);
     if (!Number.isInteger(tenantId) || tenantId <= 0) {
          return res.status(400).json({ success: false, message: 'A valid tenantId is required' });
     }

     try {
          const data = await TestAscensionTurnAroundTime.getPendingResultTATSummary(tenantId);
          return res.json({ success: true, data });
     } catch {
          return res.status(500).json({ success: false, message: 'Unable to load pending-result TAT summary' });
     }
};

export const getPendingResultTATCases = async (req: Request, res: Response) => {
     const tenantId = parseInt(String(req.query.tenantId), 10);
     const thresholdHours = parseInt(String(req.query.thresholdHours), 10);
     const page = parseInt(String(req.query.page || '1'), 10);
     const count = parseInt(String(req.query.count || '10'), 10);
     if (!Number.isInteger(tenantId) || tenantId <= 0 || !PENDING_RESULT_TAT_THRESHOLDS.includes(thresholdHours as never)) {
          return res.status(400).json({ success: false, message: 'A valid tenantId and thresholdHours are required' });
     }
     if (!Number.isInteger(page) || page < 1 || !Number.isInteger(count) || count < 1) {
          return res.status(400).json({ success: false, message: 'page and count must be positive integers' });
     }

     try {
          const data = await TestAscensionTurnAroundTime.getPendingResultTATPage(tenantId, page, count, thresholdHours);
          return res.json({ success: true, ...data });
     } catch {
          return res.status(500).json({ success: false, message: 'Unable to load pending-result TAT cases' });
     }
};
