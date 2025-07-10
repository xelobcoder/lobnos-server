"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkInsertOrganizationsHandler = void 0;
const organization_1 = __importDefault(require("../../models/organization/organization"));
const bulkInsertOrganizationsHandler = async (req, res) => {
    try {
        const tenantId = parseFloat(req.query.tenantId);
        const organizations = req.body.data;
        if (!Array.isArray(organizations) || organizations.length === 0) {
            return res.status(400).json({ success: false, message: "No organizations provided" });
        }
        const orgClass = new organization_1.default(null);
        const results = await orgClass.insertOrganizationsBulk(tenantId, organizations);
        const successCount = results.filter(r => typeof r === 'number').length;
        const failCount = results.length - successCount;
        return res.status(200).json({
            success: failCount === 0,
            partialSuccess: failCount > 0 && successCount > 0,
            total: results.length,
            successCount,
            failCount,
            results
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Bulk insert failed", error: (error === null || error === void 0 ? void 0 : error.message) || error });
    }
};
exports.bulkInsertOrganizationsHandler = bulkInsertOrganizationsHandler;
