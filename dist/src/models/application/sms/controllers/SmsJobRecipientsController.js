"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobRecipientsController = void 0;
const CreateSmsJobRecipientDto_1 = require("../dtos/CreateSmsJobRecipientDto");
class SmsJobRecipientsController {
    constructor(recipientsService) {
        this.recipientsService = recipientsService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsJobRecipientDto_1.CreateSmsJobRecipientSchema.parse(req.body);
            const id = await this.recipientsService.createRecipient(dto);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const recipient = await this.recipientsService.getRecipientById(Number(req.params.id));
        if (!recipient)
            return res.status(404).json({ error: 'Not found' });
        res.json(recipient);
    }
    async update(req, res) {
        try {
            const partialSchema = CreateSmsJobRecipientDto_1.CreateSmsJobRecipientSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.recipientsService.updateRecipient(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.recipientsService.deleteRecipient(Number(req.params.id));
        res.json({ deleted });
    }
    async getAllByJob(req, res) {
        const recipients = await this.recipientsService.getAllByJob(Number(req.params.jobId));
        res.json(recipients);
    }
}
exports.SmsJobRecipientsController = SmsJobRecipientsController;
