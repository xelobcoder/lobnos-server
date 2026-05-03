"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class AttendanceCycleService {
    static async createAttendanceCycle(tenantId, cycle) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [id] = await connection("attendanceCycles").insert(cycle);
        return Object.assign({ id }, cycle);
    }
    static async getAllAttendanceCycles(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("attendanceCycles").select("*");
    }
    static async getAttendanceCycleById(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("attendanceCycles").where({ id }).first();
    }
    static async updateAttendanceCycle(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("attendanceCycles").where({ id }).update(updates);
    }
    static async deleteAttendanceCycle(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("attendanceCycles").where({ id }).del();
    }
}
exports.default = AttendanceCycleService;
