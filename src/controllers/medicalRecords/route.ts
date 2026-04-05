import express from "express";
import {
     createAConsultationRecord,
     getConsultationRecordById,
     updateAConsultationRecord,
     deleteAConsultationRecord,
     getAllConsultationRecords,
     getAllPendingConsultationRecords,
} from "./medicalRecordsHandler";
import { handleOverLoad } from "../../hooks/helper";

const router = express.Router();

router.post("/api/v1/records/consulation", handleOverLoad(createAConsultationRecord));
router.get("/api/v1/records/consultation/get/consultation", getConsultationRecordById);
router.put("/api/v1/records/consulation/update", handleOverLoad(updateAConsultationRecord));
router.delete("/api/v1/records/consulation/delete", handleOverLoad(deleteAConsultationRecord));
router.get("/api/v1/records/consulations/records", handleOverLoad(getAllConsultationRecords));

router.get("/api/v1/records/consulations/pending/records", handleOverLoad(getAllPendingConsultationRecords));
export default router;
