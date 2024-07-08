const express = require("express");
// const  { getPatientTestTrend } from "../handlers/patientHandlers";
const { resultEntry } = require("../../../dist/controllers/result/resultHandlers");

const router = express.Router();

// router.get(`/api/v1/result/patientrend/single`, getPatientTestTrend);
router.post("/api/v1/result/entry/customtest", resultEntry);
module.exports = router;
