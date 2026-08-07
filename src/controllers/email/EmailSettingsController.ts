import { Request, Response } from 'express';
import { responseError } from '../../hooks/helper';
import { UpdateEmailSettingsSchema } from '../../models/application/email/dtos/UpdateEmailSettingsDto';
import { EmailSettingsService } from '../../models/application/email/services/EmailSettingsService';

const BAD_REQUEST_STATUS = Number('400');

export class EmailSettingsController {
     constructor(private service: EmailSettingsService) { }

     private badRequest(res: any, error: unknown): void {
          res.status(BAD_REQUEST_STATUS).send({
               status: 'error',
               statusCode: BAD_REQUEST_STATUS,
               message: error instanceof Error ? error.message : 'Invalid request payload',
          });
     }

     async get(_req: Request, res: Response) {
          try {
               const result = await this.service.getSettings();
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               responseError(res, error);
          }
     }

     async update(req: Request, res: Response) {
          try {
               const dto = UpdateEmailSettingsSchema.parse(req.body);
               const result = await this.service.updateSettings(dto);
               res.send({ status: 'success', statusCode: 200, result });
          } catch (error) {
               this.badRequest(res, error);
          }
     }
}
