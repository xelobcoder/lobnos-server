import express from "express";
import {
     createAConsultationRecord,
     getConsultationRecordById,
     updateAConsultationRecord,
     deleteAConsultationRecord,
     getAllConsultationRecords,
     getAllPendingConsultationRecords,
} from "./medicalRecordsHandler";

const router = express.Router();

router.post("/api/v1/records/consulation", createAConsultationRecord);
router.get("/api/v1/records/consultation/get/consultation", getConsultationRecordById);
router.put("/api/v1/records/consulation/update", updateAConsultationRecord);
router.delete("/api/v1/records/consulation/delete", deleteAConsultationRecord);
router.get("/api/v1/records/consulations/records", getAllConsultationRecords);

router.get("/api/v1/records/consulations/pending/records", getAllPendingConsultationRecords);
export default router;
