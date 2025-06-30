"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimesmsEventsController = void 0;
const PrimesmsEventsRepository_1 = require("./PrimesmsEventsRepository");
class PrimesmsEventsController {
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
}
exports.PrimesmsEventsController = PrimesmsEventsController;
