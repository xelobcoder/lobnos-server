import { Request, Response } from 'express';
import { customError, responseError } from '../../hooks/helper';
import { SmsProviderSettingsSchema } from '../../models/application/sms/dtos/SmsProviderSettingsDto';
import { SmsProviderSettingsRepo } from '../../models/application/sms/repositories/SmsProviderSettingsRepo';
import { SmsProviderSettingsService } from '../../models/application/sms/services/SmsProviderSettingsService';
import { getAuthUser } from '../../middleware/authority';
import { ZodError } from 'zod';

function serviceFor(req: Request): SmsProviderSettingsService | null {
     const tenantId = getAuthUser(req)?.tenantId;
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) return null;
     return new SmsProviderSettingsService(new SmsProviderSettingsRepo(Number(tenantId)));
}

export async function getSmsProviderSettings(req: Request, res: Response): Promise<void> {
     const service = serviceFor(req);
     if (!service) {
          customError('A valid tenantId is required', 400, res);
          return;
     }
     try {
          res.send({ status: 'success', statusCode: 200, result: await service.getForAdministration() });
     } catch (error) {
          responseError(res, error);
     }
}

export async function updateSmsProviderSettings(req: Request, res: Response): Promise<void> {
     const service = serviceFor(req);
     const user = getAuthUser(req);
     if (!service || !user) {
          customError('Authenticated tenant context is required', 401, res);
          return;
     }
     let dto;
     try {
          dto = SmsProviderSettingsSchema.parse(req.body);
     } catch (error) {
          customError(error instanceof ZodError ? error.issues[0]?.message : 'Invalid SMS provider settings', 400, res);
          return;
     }
     try {
          await service.save(dto, user.employeeid);
          res.send({ status: 'success', statusCode: 200, message: 'SMS provider settings updated successfully' });
     } catch (error) {
          responseError(res, error);
     }
}
