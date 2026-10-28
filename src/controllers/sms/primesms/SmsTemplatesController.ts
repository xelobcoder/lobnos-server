import { Request, Response } from 'express';
import { CreateSmsTemplateSchema } from '../../../models/application/sms/dtos/CreateSmsTemplateDto';
import { SmsTemplatesService } from '../../../models/application/sms/services/SmsTemplatesService';
import { getAuthUser } from '../../../middleware/authority';
import { ZodError } from 'zod';

export class SmsTemplatesController {
     constructor(private templatesService: SmsTemplatesService) { }

     async create(req: Request, res: Response) {
          try {
               const actor = getAuthUser(req);
               if (!actor) return res.status(401).json({ error: 'Authentication required' });
               const dto = CreateSmsTemplateSchema.parse({ ...req.body, createdBy: actor.employeeid });
               const id = await this.templatesService.createTemplate(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err instanceof ZodError ? err.issues.map(issue => issue.message).join('. ') : 'Unable to create SMS template' });
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
               const { createdBy: _createdBy, ...dto } = partialSchema.parse(req.body);
               const updated = await this.templatesService.updateTemplate(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err instanceof ZodError ? err.issues.map(issue => issue.message).join('. ') : 'Unable to update SMS template' });
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

     async getAllPaginated(req: Request, res: Response) {
          const page = parseInt(req.query.page as string) || 1;
          const count = parseInt(req.query.count as string) || 10;
          const result = await this.templatesService.getAllTemplatesPaginated(page, count);
          res.json(result);
     }
}
