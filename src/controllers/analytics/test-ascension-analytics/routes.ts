import express from "express";
import { getTatData } from "./test-ascension";

const router = express.Router();

router.get("/api/v1/testascension/tat-data", getTatData);

export default router;
