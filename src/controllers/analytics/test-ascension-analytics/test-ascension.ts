import TestAscensionTurnAroundTime from "../../../models/operations/TurnAroundTime";
import { Request, Response } from "express";


export const getTatData = async (req: Request<{}, {}, {}, TatDataQuery>, res: Response<TatDataResponse>) => {
     const page = parseInt(req.query.page) || 1;
     const count = parseInt(req.query.count) || 10;
     const tenantId = parseInt(req.query.tenantId)

     try {
          const data = await TestAscensionTurnAroundTime.getPaginatedTATData(tenantId, page, count);
           res.json({ success: true, data });
     } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
     }
};
