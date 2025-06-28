import { Request, Response } from 'express';
import { CreateSmsJobSchema } from '../dtos/CreateSmsJobDto';
import { SmsJobsService } from '../services/SmsJobsService';

export class SmsJobsController {
     constructor(private jobsService: SmsJobsService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsJobSchema.parse(req.body);
               const jobId = await this.jobsService.createJob(dto);
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
               const partialSchema = CreateSmsJobSchema.partial();
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
}
