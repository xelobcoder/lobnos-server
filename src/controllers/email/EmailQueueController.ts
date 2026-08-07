import { Request, Response } from 'express';
import { responseError } from '../../hooks/helper';
import { CreateEmailJobSchema } from '../../models/application/email/dtos/CreateEmailJobDto';
import { RetryEmailSchema } from '../../models/application/email/dtos/RetryEmailDto';
import { EmailQueueService } from '../../models/application/email/services/EmailQueueService';

const BAD_REQUEST_STATUS = Number('400');

export class EmailQueueController {
     constructor(private service: EmailQueueService) { }

     private badRequest(res: any, error: unknown): void {
          res.status(BAD_REQUEST_STATUS).send({
               status: 'error',
               statusCode: BAD_REQUEST_STATUS,
               message: error instanceof Error ? error.message : 'Invalid request payload',
          });
     }

     async queue(req: Request, res: Response) {
          try {
               const dto = CreateEmailJobSchema.parse(req.body);
               const result = await this.service.queueEmail(dto);
               res.status(201).send({ status: 'success', statusCode: 201, result });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async process(req: Request, res: Response) {
          try {
               const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
               const result = await this.service.processQueue(limit);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async processSingle(req: Request, res: Response) {
          try {
               const result = await this.service.processSingle(Number(req.params.id));
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               this.badRequest(res, error);
          }
     }

     async retry(req: Request, res: Response) {
          try {
               const dto = RetryEmailSchema.parse({
                    queueId: Number(req.params.id),
                    forceImmediate: req.body?.forceImmediate,
               });
               const result = await this.service.retryEmail(dto);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               console.log('Error in retry:', error);
               this.badRequest(res, error);
          }
     }

     async getQueue(req: Request, res: Response) {
          try {
               const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
               const result = await this.service.getQueue(limit);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               responseError(res, error);
          }
     }

     async getLogs(req: Request, res: Response) {
          try {
               const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
               const result = await this.service.getLogs(limit);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               responseError(res, error);
          }
     }

     async getAnalytics(req: Request, res: Response) {
          try {
               const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
               const result = await this.service.getAnalytics(days);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               responseError(res, error);
          }
     }
}
