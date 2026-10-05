import express from "express";
import { getPendingResultTATCases, getPendingResultTATSummary, getTatData } from "./test-ascension";
import { isAuthorizedRoleScientistPhelobotomist } from '../../../middleware/validateTenancy';

const router = express.Router();

router.get("/api/v1/testascension/tat-data", getTatData);
router.get('/api/v1/testascension/pending-result-tat/summary', isAuthorizedRoleScientistPhelobotomist, getPendingResultTATSummary);
router.get('/api/v1/testascension/pending-result-tat/cases', isAuthorizedRoleScientistPhelobotomist, getPendingResultTATCases);

export default router;
