"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeWindowAccessController = void 0;
const PrimeWindowAccessRepository_1 = __importDefault(require("../../models/settings/users/PrimeWindowAccessRepository"));
const utility_1 = require("../../hooks/utility");
class PrimeWindowAccessController {
    static async addLicense(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const repo = new PrimeWindowAccessRepository_1.default(tenantId);
            const { start_period, end_period, window_days, loginDurationPerUser } = req.body;
            const start = new Date(start_period);
            const end = new Date(end_period);
            const duplicate = await repo.checkDuplicateYearPeriod(start, end);
            if (duplicate) {
                return res.status(409).json({ status: 'error', message: 'Duplicate license period for the year' });
            }
            const id = await repo.createWindow(start, end, window_days, true, loginDurationPerUser);
            res.status(201).json({ status: 'success', message: 'License added successfully', id });
        }
        catch (error) {
            utility_1.PrimeSqlErrorHandler.handleError(error, res);
        }
    }
    static async revokeLicense(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const repo = new PrimeWindowAccessRepository_1.default(tenantId);
            const { id } = req.params;
            await repo.updateWindow(parseInt(id), { islicensedRenewed: false });
            res.json({ status: 'success', message: 'License revoked successfully' });
        }
        catch (error) {
            utility_1.PrimeSqlErrorHandler.handleError(error, res);
        }
    }
    static async checkLicense(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const repo = new PrimeWindowAccessRepository_1.default(tenantId);
            const window = await repo.getCurrentWindow();
            const isValid = await repo.validateLicense();
            res.json({ status: 'success', data: window, isValid });
        }
        catch (error) {
            utility_1.PrimeSqlErrorHandler.handleError(error, res);
        }
    }
    static async getLicenseData(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const repo = new PrimeWindowAccessRepository_1.default(tenantId);
            const window = await repo.getCurrentWindow();
            res.json({ status: 'success', data: window });
        }
        catch (error) {
            utility_1.PrimeSqlErrorHandler.handleError(error, res);
        }
    }
}
exports.PrimeWindowAccessController = PrimeWindowAccessController;
