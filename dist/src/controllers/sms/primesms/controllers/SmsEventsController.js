"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsEventsController = void 0;
const CreateSmsEventDto_1 = require("../../../../models/application/sms/dtos/CreateSmsEventDto");
class SmsEventsController {
    constructor(eventsService) {
        this.eventsService = eventsService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsEventDto_1.CreateSmsEventSchema.parse(req.body);
            const id = await this.eventsService.createEvent(dto);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const event = await this.eventsService.getEventById(Number(req.params.id));
        if (!event)
            return res.status(404).json({ error: 'Not found' });
        res.json(event);
    }
    async update(req, res) {
        try {
            const partialSchema = CreateSmsEventDto_1.CreateSmsEventSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.eventsService.updateEvent(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.eventsService.deleteEvent(Number(req.params.id));
        res.json({ deleted });
    }
    async getAll(req, res) {
        const events = await this.eventsService.getAllEvents();
        res.json(events);
    }
}
exports.SmsEventsController = SmsEventsController;
