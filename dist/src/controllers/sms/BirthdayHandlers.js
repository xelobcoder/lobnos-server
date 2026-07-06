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
    static async getWeekBirthdays(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const birthdayService = new BirthdayService_1.BirthdayService();
            const result = await birthdayService.getWeekBirthdays(tenantId, { page, limit });
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
    static async getMonthBirthdays(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const birthdayService = new BirthdayService_1.BirthdayService();
            const result = await birthdayService.getMonthBirthdays(tenantId, { page, limit });
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
    static async getAllBirthdayGroups(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const birthdayService = new BirthdayService_1.BirthdayService();
            const [today, upcoming, week, month] = await Promise.all([
                birthdayService.getTodaysBirthdays(tenantId, { page, limit }),
                birthdayService.getUpcomingBirthdays(tenantId, { page, limit }),
                birthdayService.getWeekBirthdays(tenantId, { page, limit }),
                birthdayService.getMonthBirthdays(tenantId, { page, limit })
            ]);
            res.status(200).json({
                success: true,
                page,
                limit,
                data: {
                    today,
                    upcoming,
                    week,
                    month
                }
            });
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
