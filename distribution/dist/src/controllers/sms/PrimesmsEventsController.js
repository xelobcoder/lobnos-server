"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimesmsEventsController = void 0;
const PrimesmsEventsRepository_1 = require("../../models/application/sms/events/PrimesmsEventsRepository");
class PrimesmsEventsController {
    static async setActiveStatus(req, res) {
        try {
            const tenantId = Number(req.query.tenantId) || 1;
            const id = req.params.id;
            const repo = new PrimesmsEventsRepository_1.PrimesmsEventsRepository(tenantId);
            const event = await repo.findById(id);
            const toggle = req.query.toggle === 'true' || req.query.toggle === '1' ? true : false;
            if (!event) {
                return res.status(404).json({ success: false, error: 'Event not found' });
            }
            const updated = await repo.updateActiveStatus(event.eventid, toggle);
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Event not found' });
            }
            res.json({ success: true, data: { eventid: event.eventid, active: toggle } });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message || 'Failed to update event status' });
        }
    }
    static async getAllEvents(req, res) {
        try {
            const tenantId = Number(req.query.tenantId) || 1;
            const repo = new PrimesmsEventsRepository_1.PrimesmsEventsRepository(tenantId);
            const events = await repo.getAll();
            res.json({ success: true, data: events });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message || 'Failed to load events' });
        }
    }
    static async updateTemplate(req, res) {
        try {
            const tenantId = Number(req.query.tenantId) || 1;
            const code = req.params.code;
            const { content } = req.body;
            if (!content || !content.trim()) {
                return res.status(400).json({ success: false, error: 'Content is required' });
            }
            const repo = new PrimesmsEventsRepository_1.PrimesmsEventsRepository(tenantId);
            const updated = await repo.updateTemplate(code, content);
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Event not found' });
            }
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message || 'Failed to update template' });
        }
    }
}
exports.PrimesmsEventsController = PrimesmsEventsController;
