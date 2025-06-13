"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const medicalRecordsHandler_1 = require("./medicalRecordsHandler");
const router = express_1.default.Router();
router.post("/api/v1/records/consulation", medicalRecordsHandler_1.createAConsultationRecord);
router.get("/api/v1/records/consultation/get/consultation", medicalRecordsHandler_1.getConsultationRecordById);
router.put("/api/v1/records/consulation/update", medicalRecordsHandler_1.updateAConsultationRecord);
router.delete("/api/v1/records/consulation/delete", medicalRecordsHandler_1.deleteAConsultationRecord);
router.get("/api/v1/records/consulations/records", medicalRecordsHandler_1.getAllConsultationRecords);
router.get("/api/v1/records/consulations/pending/records", medicalRecordsHandler_1.getAllPendingConsultationRecords);
exports.default = router;
