import { Request, Response } from 'express';
import KnexConnection from '../../../database/KnexConnections';
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
          const jobid = Number(req.params.jobId), page = Math.max(1, Math.floor(Number(req.query.page) || 1)), count = Math.min(100, Math.max(1, Math.floor(Number(req.query.count) || 20)));
          const db = await KnexConnection(Number(req.query.tenantId));
          const base = () => {
               let query = db('primesmsjobrecipients').where({ jobid });
               if (req.query.status) query = query.where('deliverystatus', String(req.query.status));
               if (req.query.search) query = query.where('phonee164', 'like', '%' + String(req.query.search).slice(0, 40) + '%');
               return query;
          };
          const recipients = await base().orderBy('recid').limit(count).offset((page - 1) * count);
          if (req.query.includeMeta === '1') {
               const total = await base().count('* as count').first();
               return res.json({ recipients, total: Number(total?.count || 0), page, count });
          }
          res.json(recipients);
     }
}
