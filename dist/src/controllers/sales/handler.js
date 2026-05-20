"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSalesSummaryRange = exports.handleGeneralSalesSummary = void 0;
const payments_1 = __importDefault(require("../../models/payments/payments"));
const branches_1 = __importDefault(require("../../models/application/branches/branches"));
// Sales Handlers
const handleGeneralSalesSummary = (req, res) => {
    const tenantId = parseInt(req.query.tenantId, 10);
    const { target, branch, clinicianid, patientid } = req.query;
    if (!target || !["yearly", "monthly", "daily", "weekly"].includes(target) || !branch) {
        res.status(400).send({
            status: "error",
            message: "Please provide a target and include branch in request query",
        });
    }
    else {
    }
};
exports.handleGeneralSalesSummary = handleGeneralSalesSummary;
const handleSalesSummaryRange = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { branchid, employeeid, from, to } = req.query;
        const parsedBranchid = parseInt(branchid);
        const summary = await new payments_1.default(0).summaryRangeOfDates(tenantId, from, to, parsedBranchid);
        const branch = await branches_1.default.find(tenantId, parsedBranchid);
        res.send({ summary, branch });
    }
    catch (err) {
        res.status(500).send({ status: "error", message: "Internal server error" });
    }
};
exports.handleSalesSummaryRange = handleSalesSummaryRange;
