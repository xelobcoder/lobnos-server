import { Request, Response } from 'express';
import PrimeWindowAccessRepository from '../../models/settings/users/PrimeWindowAccessRepository';
import { PrimeSqlErrorHandler } from '../../hooks/utility';

export class PrimeWindowAccessController {
     static async addLicense(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const repo = new PrimeWindowAccessRepository(tenantId);
               const { start_period, end_period, window_days, loginDurationPerUser } = req.body;
               const start = new Date(start_period);
               const end = new Date(end_period);
               const duplicate = await repo.checkDuplicateYearPeriod(start, end);
               if (duplicate) {
                    return res.status(409).json({ status: 'error', message: 'Duplicate license period for the year' });
               }
               const id = await repo.createWindow(start, end, window_days, true, loginDurationPerUser);
               res.status(201).json({ status: 'success', message: 'License added successfully', id });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error, res);
          }
     }

     static async revokeLicense(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const repo = new PrimeWindowAccessRepository(tenantId);
               const { id } = req.params;
               await repo.updateWindow(parseInt(id.toString()), { islicensedRenewed: false });
               res.json({ status: 'success', message: 'License revoked successfully' });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error, res);
          }
     }

     static async checkLicense(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const repo = new PrimeWindowAccessRepository(tenantId);
               const window = await repo.getCurrentWindow();
               const isValid = await repo.validateLicense();
               res.json({ status: 'success', data: window, isValid });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error, res);
          }
     }

     static async getLicenseData(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const repo = new PrimeWindowAccessRepository(tenantId);
               const window = await repo.getCurrentWindow();
               res.json({ status: 'success', data: window });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error, res);
          }
     }
}