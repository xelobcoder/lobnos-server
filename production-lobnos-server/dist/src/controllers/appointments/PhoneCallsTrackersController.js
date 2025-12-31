"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneCallsTrackersController = void 0;
const PhoneCallsTrackers_1 = require("../../models/appointments/PhoneCallsTrackers");
class PhoneCallsTrackersController {
    static async getPhoneCallLogsByAppointmentRef(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const appointment_refid = parseInt(req.params.appointment_refid, 10);
            if (isNaN(appointment_refid)) {
                return res.status(400).json({ error: "Missing or invalid appointment_refid in params" });
            }
            const repo = new PhoneCallsTrackers_1.PhoneCallsTrackersRepo(tenantId);
            const logs = await repo.getByAppointment(appointment_refid);
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async createPhoneCallLog(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            // Zod schema for validation
            const phoneCallLogSchema = require("zod").z.object({
                patientid: require("zod").z.number().int(),
                appointment_refid: require("zod").z.number().int().optional(),
                call_direction: require("zod").z.enum(["outbound", "inbound"]),
                purpose: require("zod").z.string(),
                scheduled_at: require("zod").z.string().optional(),
                started_at: require("zod").z.string().optional(),
                ended_at: require("zod").z.string().optional(),
                outcome: require("zod").z.enum(["answered", "no_answer", "voicemail", "failed", "busy", "declined", "left_message"]).optional(),
                status: require("zod").z.enum(["scheduled", "in_progress", "completed", "missed", "cancelled"]),
                call_reference_id: require("zod").z.string().max(255).optional(),
                recording_url: require("zod").z.string().max(500).optional(),
                notes: require("zod").z.string().optional(),
                retry_count: require("zod").z.number().int().optional(),
                next_followup_at: require("zod").z.string().optional(),
                created_by: require("zod").z.number().int().optional(),
            });
            const parseResult = phoneCallLogSchema.safeParse(req.body);
            if (!parseResult.success) {
                return res.status(400).json({ error: "Invalid phone call log fields", details: parseResult.error.errors });
            }
            const repo = new PhoneCallsTrackers_1.PhoneCallsTrackersRepo(tenantId);
            const id = await repo.create(parseResult.data);
            res.status(201).json({ status: id ? "success" : "error", id });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getPhoneCallLog(req, res) {
        try {
            if (!req.query.tenantId) {
                return res.status(400).json({ error: "Missing tenantId in query" });
            }
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id, 10);
            const repo = new PhoneCallsTrackers_1.PhoneCallsTrackersRepo(tenantId);
            const log = await repo.getById(id);
            if (!log)
                return res.status(404).json({ error: "Not found" });
            res.json(log);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async updatePhoneCallLog(req, res) {
        try {
            if (!req.query.tenantId) {
                return res.status(400).json({ error: "Missing tenantId in query" });
            }
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id, 10);
            const repo = new PhoneCallsTrackers_1.PhoneCallsTrackersRepo(tenantId);
            const updated = await repo.update(id, req.body);
            res.json(updated);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async listPhoneCallLogs(req, res) {
        try {
            if (!req.query.tenantId) {
                return res.status(400).json({ error: "Missing tenantId in query" });
            }
            const tenantId = parseInt(req.query.tenantId, 10);
            const repo = new PhoneCallsTrackers_1.PhoneCallsTrackersRepo(tenantId);
            const logs = await repo.list(req.query);
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async listPhoneCallLogsWithPagination(req, res) {
        try {
            if (!req.query.tenantId) {
                return res.status(400).json({ error: "Missing tenantId in query" });
            }
            const tenantId = parseInt(req.query.tenantId, 10);
            const page = parseInt(req.query.page, 10) || 1;
            const count = parseInt(req.query.count, 10) || 10;
            const _a = req.query, { page: _, count: __, tenantId: ___ } = _a, filter = __rest(_a, ["page", "count", "tenantId"]);
            const repo = new PhoneCallsTrackers_1.PhoneCallsTrackersRepo(tenantId);
            const result = await repo.listWithPagination(page, count, filter);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.PhoneCallsTrackersController = PhoneCallsTrackersController;
