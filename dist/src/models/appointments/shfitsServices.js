"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ShiftService {
    static async createShift(tenantId, shift) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        await connection("shifts")
            .insert(shift)
            .onConflict("name")
            .merge();
        return shift;
    }
    static async getAllShifts(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("shifts").select("*");
    }
    static async getShiftById(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("shifts").where({ id }).first();
    }
    static async updateShift(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection("shifts").where({ id }).update(updates);
        return updated ? Object.assign({ id }, updates) : null;
    }
    static async deleteShift(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection("shifts").where({ id }).del();
    }
    static async loadDefaultShifts(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const defaultShifts = [
            {
                name: "Morning",
                color: "#FFA500",
                starttime: "08:00:00",
                endtime: "12:00:00"
            },
            {
                name: "Afternoon",
                color: "#008000",
                starttime: "13:00:00",
                endtime: "17:00:00"
            },
            {
                name: "Evening",
                color: "#0000FF",
                starttime: "18:00:00",
                endtime: "22:00:00"
            }
        ];
        const existingShifts = await connection("shifts")
            .select("name")
            .whereIn("name", defaultShifts.map(shift => shift.name));
        const existingShiftNames = existingShifts.map((shift) => shift.name);
        for (const shift of defaultShifts) {
            if (!existingShiftNames.includes(shift.name)) {
                await connection("shifts").insert(shift);
            }
        }
    }
}
exports.default = ShiftService;
