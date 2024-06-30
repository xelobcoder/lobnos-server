"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultEntry = exports.getPatientTestTrend = void 0;
const logger_1 = __importDefault(require("../../../logger"));
const helper_1 = require("../../../helper");
const patientAnalytics_1 = __importDefault(require("../models/patientAnalytics"));
const creator_1 = __importDefault(require("../../models/creator/creator"));
const getPatientTestTrend = async (req, res) => {
    const { patientid, testid, test, instances } = req.query;
    try {
        const result = await new patientAnalytics_1.default(patientid).getPatientTestTrend(patientid, testid, test, instances);
        res.send({ statusCode: 200, status: "success", result });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.customError)("Error occurred", 500, res);
    }
};
exports.getPatientTestTrend = getPatientTestTrend;
const resultEntry = (req, res) => {
    try {
        new creator_1.default().resultEntry(req, res);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.resultEntry = resultEntry;
