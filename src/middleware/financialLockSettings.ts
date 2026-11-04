import { Router, type Request, type Response } from 'express';
import { getAuthUser, requireOwnerRole } from './authority';
import { AccountingError } from '../accountingModule/errors/AccountingErrors';
import { FinancialLockSettingsService } from '../accountingModule/services/FinancialLockSettingsService';
import logger from '../hooks/logger';

const router = Router();
router.use('/api/v1/financial-day/settings', requireOwnerRole);
router.use('/api/v1/financial-day/historical-locks', requireOwnerRole);

function handler(action: 'get' | 'save' | 'preview' | 'migrate') {
     return async (request: Request, response: Response) => {
          response.setHeader('Cache-Control', 'private, no-store');
          const actor = getAuthUser(request);
          if (!actor) return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required.' });
          try {
               const service = new FinancialLockSettingsService(actor.tenantId), branch = Number(actor.branch);
               const body = request.body ?? {};
               const result = action === 'get' ? await service.get(branch)
                    : action === 'save' ? await service.save(branch, actor.employeeid, body)
                    : action === 'preview' ? await service.preview(branch, body)
                    : await service.migrate(branch, actor.employeeid, body);
               return response.json({ status: 'success', statusCode: 200, result });
          } catch (error) {
               if (error instanceof AccountingError) return response.status(error.statusCode).json({
                    status: 'error', statusCode: error.statusCode, code: error.code, message: error.message,
               });
               logger.error('Financial lock settings operation failed', {
                    tenantId: actor.tenantId, branchId: actor.branch, action,
                    message: error instanceof Error ? error.message : String(error),
               });
               return response.status(503).json({
                    status: 'error', statusCode: 503, code: 'FINANCIAL_LOCK_SETTINGS_FAILED',
                    message: 'Unable to complete the financial lock settings operation. Refresh the settings to verify their current state before retrying.',
               });
          }
     };
}
router.get('/api/v1/financial-day/settings', handler('get'));
router.put('/api/v1/financial-day/settings', handler('save'));
router.post('/api/v1/financial-day/historical-locks/preview', handler('preview'));
router.post('/api/v1/financial-day/historical-locks', handler('migrate'));
export default router;
