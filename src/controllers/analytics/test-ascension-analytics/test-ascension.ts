import TestAscensionTurnAroundTime from "../../../models/operations/TurnAroundTime";
import { Request, Response } from "express";




export const getTatData = async (req: Request<{}, {}, {}, { page?: string, count?: string, tenantId: string, sortby?: string }>, res: Response<TatDataResponse>) => {
     const page = req.query.page ? parseInt(req.query.page) || 1 : 1;
     const count = req.query.count ? parseInt(req.query.count) || 10 : 10;
     const tenantId = parseInt(req.query.tenantId)
     const sorting = req.query.sortby?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
     try {
          const data = await TestAscensionTurnAroundTime.getPaginatedTATData(tenantId, page, count,sorting);
           res.json({ success: true, data });
     } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
     }
};
