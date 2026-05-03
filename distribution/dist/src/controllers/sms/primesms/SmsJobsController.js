"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobsController = void 0;
const zod_1 = require("zod");
const CreateSmsJobDto_1 = require("../../../models/application/sms/dtos/CreateSmsJobDto");
const BaseSmsJobSchema = zod_1.z.object({
    templateId: zod_1.z.number().optional(),
    customBody: zod_1.z.string().optional(),
    category: zod_1.z.enum(['patient', 'clinician', 'organization']),
    recipientScope: zod_1.z.enum(['single', 'multiple', 'all']),
    sendType: zod_1.z.enum(['immediate', 'scheduled']),
    scheduledAt: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
    createdBy: zod_1.z.number(),
});
class SmsJobsController {
    constructor(jobsService) {
        this.jobsService = jobsService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsJobDto_1.CreateSmsJobSchema.parse(req.body);
            const tenantId = parseInt(req.query.tenantId.toString());
            const jobId = await this.jobsService.createJob(dto, tenantId);
            res.status(201).json({ jobId });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const job = await this.jobsService.getJobById(Number(req.params.id));
        if (!job)
            return res.status(404).json({ error: 'Not found' });
        res.json(job);
    }
    async update(req, res) {
        try {
            const partialSchema = BaseSmsJobSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.jobsService.updateJob(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.jobsService.deleteJob(Number(req.params.id));
        res.json({ deleted });
    }
    async getAllPaginated(req, res) {
        const page = parseInt(req.query.page) || 1;
        const count = parseInt(req.query.count) || 10;
        const result = await this.jobsService.getAllJobsPaginated(page, count);
        res.json(result);
    }
}
exports.SmsJobsController = SmsJobsController;
