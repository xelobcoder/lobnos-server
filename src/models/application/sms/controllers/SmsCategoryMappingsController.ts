import { Request, Response } from 'express';
import { CreateSmsCategoryMappingSchema } from '../../../../models/application/sms/dtos/CreateSmsCategoryMappingDto';
import { SmsCategoryMappingsService } from '../../../../models/application/sms/services/SmsCategoryMappingsService';

export class SmsCategoryMappingsController {
     constructor(private mappingsService: SmsCategoryMappingsService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsCategoryMappingSchema.parse(req.body);
               const id = await this.mappingsService.createMapping(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const mapping = await this.mappingsService.getMappingById(Number(req.params.id));
          if (!mapping) return res.status(404).json({ error: 'Not found' });
          res.json(mapping);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = CreateSmsCategoryMappingSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.mappingsService.updateMapping(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.mappingsService.deleteMapping(Number(req.params.id));
          res.json({ deleted });
     }

     async getAll(req: Request, res: Response) {
          const mappings = await this.mappingsService.getAllMappings();
          res.json(mappings);
     }
}
