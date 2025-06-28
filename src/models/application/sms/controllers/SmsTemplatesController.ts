import { Request, Response } from 'express';
import { CreateSmsTemplateSchema } from '../dtos/CreateSmsTemplateDto';
import { SmsTemplatesService } from '../services/SmsTemplatesService';

export class SmsTemplatesController {
     constructor(private templatesService: SmsTemplatesService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsTemplateSchema.parse(req.body);
               const id = await this.templatesService.createTemplate(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const template = await this.templatesService.getTemplateById(Number(req.params.id));
          if (!template) return res.status(404).json({ error: 'Not found' });
          res.json(template);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = CreateSmsTemplateSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.templatesService.updateTemplate(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.templatesService.deleteTemplate(Number(req.params.id));
          res.json({ deleted });
     }

     async getAll(req: Request, res: Response) {
          const templates = await this.templatesService.getAllTemplates();
          res.json(templates);
     }
}
