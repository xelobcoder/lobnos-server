"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneCallsTrackersRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PhoneCallsTrackersRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async getConn() {
        return await (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(data) {
        const conn = await this.getConn();
        // Only allow fields that exist in the DB table
        const allowedFields = [
            "patientid", "appointment_refid", "call_direction", "purpose", "scheduled_at", "started_at", "ended_at",
            "outcome", "status", "call_reference_id", "recording_url", "notes", "retry_count", "next_followup_at",
            "created_by", "metadata"
        ];
        const filteredData = {};
        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                filteredData[key] = data[key];
            }
        }
        const [id] = await conn("phone_call_logs").insert(filteredData);
        return id;
    }
    async getById(id) {
        const conn = await this.getConn();
        const row = await conn("phone_call_logs").where({ id }).first();
        return row || null;
    }
    async update(id, data) {
        const conn = await this.getConn();
        await conn("phone_call_logs").where({ id }).update(data);
        return await this.getById(id);
    }
    async delete(id) {
        const conn = await this.getConn();
        return await conn("phone_call_logs").where({ id }).del();
    }
    async list(filter = {}) {
        const conn = await this.getConn();
        return await conn("phone_call_logs").where(filter);
    }
    async listWithPagination(page = 1, limit = 10, filter = {}) {
        const conn = await this.getConn();
        const offset = (page - 1) * limit;
        const [data, totalCount] = await Promise.all([
            conn("phone_call_logs as pcl")
                .leftJoin("roles as r", "pcl.created_by", "r.employeeid")
                .select("pcl.*", "r.username as creator_name", "r.role as creator_role", "r.email as creator_email")
                .where(filter)
                .orderBy("pcl.created_at", "desc")
                .limit(limit)
                .offset(offset),
            conn("phone_call_logs")
                .where(filter)
                .count("id as count")
                .first()
        ]);
        return {
            data,
            pagination: {
                page,
                limit,
                total: Number(totalCount === null || totalCount === void 0 ? void 0 : totalCount.count) || 0,
                totalPages: Math.ceil((Number(totalCount === null || totalCount === void 0 ? void 0 : totalCount.count) || 0) / limit)
            }
        };
    }
    async getByPatient(patientid) {
        const conn = await this.getConn();
        return await conn("phone_call_logs").where({ patientid }).orderBy("created_at", "desc");
    }
    async getByAppointment(appointment_refid) {
        const conn = await this.getConn();
        return await conn("phone_call_logs").where({ appointment_refid }).orderBy("created_at", "desc");
    }
    async getRecent(limit = 10) {
        const conn = await this.getConn();
        return await conn("phone_call_logs").orderBy("created_at", "desc").limit(limit);
    }
    async getScheduledCalls() {
        const conn = await this.getConn();
        return await conn("phone_call_logs").where({ status: 'scheduled' }).orderBy("scheduled_at", "asc");
    }
    async getMissedCalls(patientid) {
        const conn = await this.getConn();
        let query = conn("phone_call_logs").where({ status: 'missed' });
        if (patientid)
            query = query.andWhere({ patientid });
        return await query.orderBy("created_at", "desc");
    }
    async getCallsByDirection(direction, limit = 10) {
        const conn = await this.getConn();
        return await conn("phone_call_logs").where({ call_direction: direction }).orderBy("created_at", "desc").limit(limit);
    }
    async getCallsWithFollowupDue() {
        const conn = await this.getConn();
        return await conn("phone_call_logs")
            .whereNotNull("next_followup_at")
            .andWhere("next_followup_at", "<=", conn.raw("CURRENT_TIMESTAMP"))
            .orderBy("next_followup_at", "asc");
    }
}
exports.PhoneCallsTrackersRepo = PhoneCallsTrackersRepo;
