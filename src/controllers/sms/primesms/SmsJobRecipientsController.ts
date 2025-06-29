import { Request, Response } from 'express';
import { CreateSmsJobRecipientSchema } from '../../../models/application/sms/dtos/CreateSmsJobRecipientDto';
import { SmsJobRecipientsService } from '../../../models/application/sms/services/SmsJobRecipientsService';

export class SmsJobRecipientsController {
     constructor(private recipientsService: SmsJobRecipientsService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsJobRecipientSchema.parse(req.body);
               const id = await this.recipientsService.createRecipient(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const recipient = await this.recipientsService.getRecipientById(Number(req.params.id));
          if (!recipient) return res.status(404).json({ error: 'Not found' });
          res.json(recipient);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = CreateSmsJobRecipientSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.recipientsService.updateRecipient(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.recipientsService.deleteRecipient(Number(req.params.id));
          res.json({ deleted });
     }

     async getAllByJob(req: Request, res: Response) {
          const jobId = Number(req.params.jobId);
          const page = req.query.page ? Number(req.query.page) : 1;
          const count = req.query.count ? Number(req.query.count) : 20;
          const recipients = await this.recipientsService.getAllByJob(jobId, page, count);
          res.json(recipients);
     }
}
