"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsTemplatesController = void 0;
const CreateSmsTemplateDto_1 = require("../../../../models/application/sms/dtos/CreateSmsTemplateDto");
class SmsTemplatesController {
    constructor(templatesService) {
        this.templatesService = templatesService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsTemplateDto_1.CreateSmsTemplateSchema.parse(req.body);
            const id = await this.templatesService.createTemplate(dto);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const template = await this.templatesService.getTemplateById(Number(req.params.id));
        if (!template)
            return res.status(404).json({ error: 'Not found' });
        res.json(template);
    }
    async update(req, res) {
        try {
            const partialSchema = CreateSmsTemplateDto_1.CreateSmsTemplateSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.templatesService.updateTemplate(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.templatesService.deleteTemplate(Number(req.params.id));
        res.json({ deleted });
    }
    async getAll(req, res) {
        const templates = await this.templatesService.getAllTemplates();
        res.json(templates);
    }
}
exports.SmsTemplatesController = SmsTemplatesController;
