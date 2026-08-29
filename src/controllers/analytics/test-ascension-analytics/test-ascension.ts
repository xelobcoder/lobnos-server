import TestAscensionTurnAroundTime from "../../../models/operations/TurnAroundTime";
import { Request, Response } from "express";




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
