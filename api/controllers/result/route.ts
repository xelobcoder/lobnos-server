// routes/apiRoutes.ts
import express from "express";
import { getPatientTestTrend } from "../handlers/patientHandlers";
import { resultEntry } from "../handlers/creatorHandlers";

const router = express.Router();

router.get(`/api/v1/result/patientrend/single`, getPatientTestTrend);
router.post("/api/v1/result/entry/customtest", resultEntry);

export default router;
