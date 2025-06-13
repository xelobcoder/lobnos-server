import { Router } from "express";
import { handleGeneralSalesSummary, handleSalesSummaryRange } from "./handler";
const router = Router();


router.get("/api/v1/sales/summary/general", handleGeneralSalesSummary);
router.get("/api/v1/summary/daily", handleSalesSummaryRange);

export default router;
