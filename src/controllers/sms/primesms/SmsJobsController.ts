import { z } from 'zod';
import { Request, Response } from 'express';
import { CreateSmsJobSchema } from '../../../models/application/sms/dtos/CreateSmsJobDto';
import { SmsJobsService } from '../../../models/application/sms/services/SmsJobsService';


const BaseSmsJobSchema = z.object({
     templateId: z.number().optional(),
     customBody: z.string().optional(),
     category: z.enum(['patient', 'clinician', 'organization']),
     recipientScope: z.enum(['single', 'multiple', 'all']),
     sendType: z.enum(['immediate', 'scheduled']),
     scheduledAt: z.string().datetime().optional(),
     status: z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
     createdBy: z.number(),
});

export class SmsJobsController {
     constructor(private jobsService: SmsJobsService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsJobSchema.parse(req.body);
               const tenantId = parseInt(req.query.tenantId.toString());
               const jobId = await this.jobsService.createJob(dto,tenantId);
               res.status(201).json({ jobId });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const job = await this.jobsService.getJobById(Number(req.params.id));
          if (!job) return res.status(404).json({ error: 'Not found' });
          res.json(job);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = BaseSmsJobSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.jobsService.updateJob(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.jobsService.deleteJob(Number(req.params.id));
          res.json({ deleted });
     }

     async getAllPaginated(req: Request, res: Response) {
          const page = parseInt(req.query.page as string) || 1;
          const count = parseInt(req.query.count as string) || 10;
          const result = await this.jobsService.getAllJobsPaginated(page, count);
          res.json(result);
     }
}
