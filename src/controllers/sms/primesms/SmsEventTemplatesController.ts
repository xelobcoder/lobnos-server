import { Request, Response } from 'express';
import { CreateSmsEventTemplateSchema } from '../../../models/application/sms/dtos/CreateSmsEventTemplateDto';
import { SmsEventTemplatesService } from '../../../models/application/sms/services/SmsEventTemplatesService';

export class SmsEventTemplatesController {
     constructor(private eventTemplatesService: SmsEventTemplatesService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsEventTemplateSchema.parse(req.body);
               const id = await this.eventTemplatesService.createEventTemplate(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const eventTemplate = await this.eventTemplatesService.getEventTemplateById(Number(req.params.id));
          if (!eventTemplate) return res.status(404).json({ error: 'Not found' });
          res.json(eventTemplate);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = CreateSmsEventTemplateSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.eventTemplatesService.updateEventTemplate(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.eventTemplatesService.deleteEventTemplate(Number(req.params.id));
          res.json({ deleted });
     }

     async getAllByEvent(req: Request, res: Response) {
          const eventTemplates = await this.eventTemplatesService.getAllByEvent(Number(req.params.eventId));
          res.json(eventTemplates);
     }

     async getAllByTemplate(req: Request, res: Response) {
          const eventTemplates = await this.eventTemplatesService.getAllByTemplate(Number(req.params.templateId));
          res.json(eventTemplates);
     }
}
