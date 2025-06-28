"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobsController = void 0;
const CreateSmsJobDto_1 = require("../dtos/CreateSmsJobDto");
class SmsJobsController {
    constructor(jobsService) {
        this.jobsService = jobsService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsJobDto_1.CreateSmsJobSchema.parse(req.body);
            const jobId = await this.jobsService.createJob(dto);
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
            const partialSchema = CreateSmsJobDto_1.CreateSmsJobSchema.partial();
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
}
exports.SmsJobsController = SmsJobsController;
