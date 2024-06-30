"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const operationsHandlers_1 = require("./operationsHandlers");
const router = express_1.default.Router();
router.get("/api/v1/operations/collection", operationsHandlers_1.getAllCollections);
router.get("/api/v1/operations/test", operationsHandlers_1.getBillingTest);
router.put("/api/v1/operations/test/initiateprocessing", operationsHandlers_1.initiateProcessing);
router.get("/api/v1/operations/collection/result", operationsHandlers_1.getAllEnterResult);
router.get("/api/v1/operations/test/result", operationsHandlers_1.getAllTestPreview);
router.get("/api/v1/operation/pendingcases/all", operationsHandlers_1.getAllPendingCases);
router.get("/api/v1/operations/imaging/ultrasound", operationsHandlers_1.getUltrasoundWaitingList);
router.get("/api/v1/operations/imaging/ultrasound/processed", operationsHandlers_1.getProcessedScanList);
exports.default = router;
