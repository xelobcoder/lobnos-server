"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsEventTemplatesController = void 0;
const CreateSmsEventTemplateDto_1 = require("../../../models/application/sms/dtos/CreateSmsEventTemplateDto");
class SmsEventTemplatesController {
    constructor(eventTemplatesService) {
        this.eventTemplatesService = eventTemplatesService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsEventTemplateDto_1.CreateSmsEventTemplateSchema.parse(req.body);
            const id = await this.eventTemplatesService.createEventTemplate(dto);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const eventTemplate = await this.eventTemplatesService.getEventTemplateById(Number(req.params.id));
        if (!eventTemplate)
            return res.status(404).json({ error: 'Not found' });
        res.json(eventTemplate);
    }
    async update(req, res) {
        try {
            const partialSchema = CreateSmsEventTemplateDto_1.CreateSmsEventTemplateSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.eventTemplatesService.updateEventTemplate(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.eventTemplatesService.deleteEventTemplate(Number(req.params.id));
        res.json({ deleted });
    }
    async getAllByEvent(req, res) {
        const eventTemplates = await this.eventTemplatesService.getAllByEvent(Number(req.params.eventId));
        res.json(eventTemplates);
    }
    async getAllByTemplate(req, res) {
        const eventTemplates = await this.eventTemplatesService.getAllByTemplate(Number(req.params.templateId));
        res.json(eventTemplates);
    }
}
exports.SmsEventTemplatesController = SmsEventTemplatesController;
