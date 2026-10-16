import { Request, Response } from 'express';
import { customError, responseError } from '../../hooks/helper';
import { parsePagination } from '../../hooks/pagination';
import { CreateEmailProviderSchema } from '../../models/application/email/dtos/CreateEmailProviderDto';
import { EmailProvidersService } from '../../models/application/email/services/EmailProvidersService';
import { z } from 'zod';

const SendTestEmailSchema = z.object({ to: z.string().trim().email() });

const BAD_REQUEST_STATUS = Number('400');

export class EmailProvidersController {
     constructor(private service: EmailProvidersService) { }

     private badRequest(res: any, error: unknown): void {
          res.status(BAD_REQUEST_STATUS).send({
               status: 'error',
               statusCode: BAD_REQUEST_STATUS,
               message: error instanceof Error ? error.message : 'Invalid request payload',
          });
     }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateEmailProviderSchema.parse(req.body);
               const id = await this.service.create(dto);
               res.status(201).send({ status: 'success', statusCode: 201, id });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async update(req: Request, res: Response) {
          try {
               const dto = CreateEmailProviderSchema.partial().parse(req.body);
               const updated = await this.service.update(Number(req.params.id), dto);
               res.send({ status: 'success', statusCode: 200, updated });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async getById(req: Request, res: Response) {
          try {
               const provider = await this.service.getById(Number(req.params.id));
               if (!provider) {
                    return customError('Email provider not found', 404, res);
               }
               res.send({ status: 'success', statusCode: 200, result: provider });
          } catch (error) {
               responseError(res, error);
          }
     }

     async getAll(req: Request, res: Response) {
          try {
               const { page, count } = parsePagination(req.query, { defaultCount: 20, maxCount: 100 });
               const providers = await this.service.getAll(page, count);
               res.send({ status: 'success', statusCode: 200, result: providers });
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

     async testConnection(req: Request, res: Response) {
          try {
               const connected = await this.service.testProvider(Number(req.params.id));
               res.send({ status: 'success', statusCode: 200, connected });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async sendTestEmail(req: Request, res: Response) {
          try {
               const { to } = SendTestEmailSchema.parse(req.body);
               const result = await this.service.sendTestEmail(Number(req.params.id), to);
               res.send({ status: 'success', statusCode: 200, ...result });
          } catch (error) {
               this.badRequest(res, error);
          }
     }
}
