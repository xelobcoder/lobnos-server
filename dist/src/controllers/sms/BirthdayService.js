"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirthdayService = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const BirthdayQueries_1 = require("../../models/application/sms/events/BirthdayQueries");
class BirthdayService {
    async getTodaysBirthdays(tenantId, { page = 1, limit = 10 }) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const offset = (page - 1) * limit;
        const [data] = await connection.raw(BirthdayQueries_1.BirthdayQueries.getTodaysBirthdays, [limit, offset]);
        const [countResult] = await connection.raw(BirthdayQueries_1.BirthdayQueries.getTodaysBirthdaysCount);
        const total = countResult[0].total;
        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
    async getUpcomingBirthdays(tenantId, { page = 1, limit = 10 }) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const offset = (page - 1) * limit;
        const [data] = await connection.raw(BirthdayQueries_1.BirthdayQueries.getUpcomingBirthdays, [limit, offset]);
        const [countResult] = await connection.raw(BirthdayQueries_1.BirthdayQueries.getUpcomingBirthdaysCount);
        const total = countResult[0].total;
        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
}
exports.BirthdayService = BirthdayService;
