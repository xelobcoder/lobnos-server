"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirthdayHandlers = void 0;
const BirthdayService_1 = require("./BirthdayService");
class BirthdayHandlers {
    static async getTodaysBirthdays(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const birthdayService = new BirthdayService_1.BirthdayService();
            const result = await birthdayService.getTodaysBirthdays(tenantId, { page, limit });
            res.status(200).json(Object.assign(Object.assign({ success: true }, result), { page,
                limit, totalPages: Math.ceil(result.total / limit) }));
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    static async getUpcomingBirthdays(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const birthdayService = new BirthdayService_1.BirthdayService();
            const result = await birthdayService.getUpcomingBirthdays(tenantId, { page, limit });
            res.status(200).json(Object.assign(Object.assign({ success: true }, result), { page,
                limit, totalPages: Math.ceil(result.total / limit) }));
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}
exports.BirthdayHandlers = BirthdayHandlers;
