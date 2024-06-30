"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcessedScanList = exports.getUltrasoundWaitingList = exports.getAllPendingCases = exports.getAllTestPreview = exports.getAllEnterResult = exports.initiateProcessing = exports.getBillingTest = exports.getAllCollections = void 0;
const helper_1 = require("../../helper");
const operations_1 = __importDefault(require("../models/operations"));
const getAllCollections = async (req, res) => {
    const collections = new operations_1.default();
    const result = await collections.getAllReadyTest(req);
    res.send({ statusCode: 200, message: "success", result });
};
exports.getAllCollections = getAllCollections;
const getBillingTest = async (req, res) => {
    const { billingid } = req.query;
    if (!billingid) {
        res.status(400).send({
            statusCode: 400,
            message: "Invalid billingid",
        });
        return;
    }
    const result = await new operations_1.default(billingid).billingTest(req);
    if (result === "Billingid is not ready for testing") {
        res.status(400).send({
            statusCode: 400,
            message: result,
        });
    }
    else {
        res.send({
            statusCode: 200,
            message: "success",
            result,
        });
    }
};
exports.getBillingTest = getBillingTest;
const initiateProcessing = async (req, res) => {
    const { billingid, testid } = req.query;
    if (!billingid || !testid) {
        (0, helper_1.customError)("billing id or testid is missing", 404, res);
        return;
    }
    const updatesProcessing = new operations_1.default(billingid);
    const result = await updatesProcessing.initiateStart(testid, billingid);
    res.send({ status: (0, helper_1.rowAffected)(result) ? "success" : "failed" });
};
exports.initiateProcessing = initiateProcessing;
const getAllEnterResult = async (req, res) => {
    await new operations_1.default().getAllEnterResult(req, res);
};
exports.getAllEnterResult = getAllEnterResult;
const getAllTestPreview = async (req, res) => {
    await new operations_1.default().getAllTestPreview(req, res);
};
exports.getAllTestPreview = getAllTestPreview;
const getAllPendingCases = async (req, res) => {
    const { count = 10, page = 1, departmentid, status, testid } = req.query;
    await new operations_1.default().getAllPendingCases(count, page, departmentid, status, testid, res);
};
exports.getAllPendingCases = getAllPendingCases;
const getUltrasoundWaitingList = async (req, res) => {
    await new operations_1.default().getUltrasoundWaitingList(req, res);
};
exports.getUltrasoundWaitingList = getUltrasoundWaitingList;
const getProcessedScanList = async (req, res) => {
    await new operations_1.default().processedScanList(req, res);
};
exports.getProcessedScanList = getProcessedScanList;
