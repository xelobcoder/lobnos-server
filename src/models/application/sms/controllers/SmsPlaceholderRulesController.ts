import { Request, Response } from 'express';
import { CreateSmsPlaceholderRuleSchema } from '../../../../models/application/sms/dtos/CreateSmsPlaceholderRuleDto';
import { SmsPlaceholderRulesService } from '../../../../models/application/sms/services/SmsPlaceholderRulesService';

export class SmsPlaceholderRulesController {
     constructor(private rulesService: SmsPlaceholderRulesService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsPlaceholderRuleSchema.parse(req.body);
               const id = await this.rulesService.createRule(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const rule = await this.rulesService.getRuleById(Number(req.params.id));
          if (!rule) return res.status(404).json({ error: 'Not found' });
          res.json(rule);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = CreateSmsPlaceholderRuleSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.rulesService.updateRule(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.rulesService.deleteRule(Number(req.params.id));
          res.json({ deleted });
     }

     async getAll(req: Request, res: Response) {
          const rules = await this.rulesService.getAllRules();
          res.json(rules);
     }
}
