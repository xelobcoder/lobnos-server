"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const insuranceHandler_1 = require("./insuranceHandler");
const helper_1 = require("../../hooks/helper");
const router = express_1.default.Router();
router.post('/api/v1/insurances', (0, helper_1.handleOverLoad)(insuranceHandler_1.createInsurance));
router.get('/api/v1/insurances', insuranceHandler_1.getAllInsurances);
router.get('/api/v1/insurances/:insuranceId', insuranceHandler_1.getInsuranceById);
router.put('/api/v1/insurances/:insuranceId', insuranceHandler_1.updateInsurance);
router.delete('/api/v1/insurances/:insuranceId', insuranceHandler_1.deleteInsurance);
exports.default = router;
