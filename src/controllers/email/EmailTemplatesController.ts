import { Request, Response } from 'express';
import { z } from 'zod';
import { customError, responseError } from '../../hooks/helper';
import { CreateEmailTemplateSchema } from '../../models/application/email/dtos/CreateEmailTemplateDto';
import { EmailTemplatesService } from '../../models/application/email/services/EmailTemplatesService';

const BAD_REQUEST_STATUS = Number('400');

export class EmailTemplatesController {
     constructor(private service: EmailTemplatesService) { }

     private badRequest(res: any, error: unknown): void {
          res.status(BAD_REQUEST_STATUS).send({
               status: 'error',
               statusCode: BAD_REQUEST_STATUS,
               message: error instanceof Error ? error.message : 'Invalid request payload',
          });
     }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateEmailTemplateSchema.parse(req.body);
               const id = await this.service.create(dto);
               res.status(201).send({ status: 'success', statusCode: 201, id });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async update(req: Request, res: Response) {
          try {
               const dto = CreateEmailTemplateSchema.partial().parse(req.body);
               const updated = await this.service.update(Number(req.params.id), dto);
               res.send({ status: 'success', statusCode: 200, updated });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async getById(req: Request, res: Response) {
          try {
               const template = await this.service.getById(Number(req.params.id));
               if (!template) {
                    return customError('Email template not found', 404, res);
               }
               res.send({ status: 'success', statusCode: 200, result: template });
          } catch (error) {
               responseError(res, error);
          }
     }

     async getAll(_req: Request, res: Response) {
          try {
               const templates = await this.service.getAll();
               res.send({ status: 'success', statusCode: 200, result: templates });
          } catch (error) {
               responseError(res, error);
          }
     }

     async delete(req: Request, res: Response) {
          try {
               const deleted = await this.service.delete(Number(req.params.id));
               res.send({ status: 'success', statusCode: 200, deleted });
          } catch (error) {
               responseError(res, error);
          }
     }

     async preview(req: Request, res: Response) {
          try {
               const previewSchema = z.object({ variables: z.record(z.string(), z.unknown()).optional().default({}) });
               const dto = previewSchema.parse(req.body);
               const result = await this.service.preview(Number(req.params.id), dto.variables);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               this.badRequest(res, error);
          }
     }
}
