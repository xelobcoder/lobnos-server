import { Request, Response, NextFunction } from 'express';
import KnexConnection from '../database/KnexConnections';
import { customError, responseError } from '../hooks/helper';
import logger from '../hooks/logger';
import { FacilityModule, validateModuleConfiguration } from '../models/Tenancy/FacilityModules';

export function moduleForApiPath(path: string): FacilityModule | null {
     if (/^\/api\/v1\/pharmacy(?:\/|$)/i.test(path)) return 'pharmacy';
     if (/^\/api\/v1\/inventory(?:\/|$)/i.test(path)) return 'inventory';
     if (/^\/api\/v1\/email(?:\/|$)/i.test(path)) return 'email';
     if (/^\/api\/v1\/(?:sms(?:\/|$)|prime\/sms(?:[-/]|$))/i.test(path)) return 'sms';
     if (/^\/api\/v1\/(?:interfacing\/devices|devices\/interfacing)(?:\/|$)/i.test(path)) return 'deviceInterfacing';
     return null;
}

export async function facilityModuleAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
     const module = moduleForApiPath(req.path);
     const creatingBranch = req.method === 'POST' && /^\/api\/v1\/branches\/?$/i.test(req.path);
     if (!module && !creatingBranch) { next(); return; }
     const tenantId = Number(req.query.tenantId);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { customError('Invalid tenantId', 400, res); return; }
     try {
          const db = await KnexConnection(tenantId);
          const settings = await db('applicationsettings').where({ keyid: 1 }).first();
          if (!settings?.moduleConfiguration) { next(); return; }
          const config = validateModuleConfiguration(JSON.parse(settings.moduleConfiguration));
          if (!config) throw new Error('Invalid stored module configuration');
          const enabled = module && (config.modules[module].enabled ||
               (module === 'inventory' && config.modules.pharmacy.enabled));
          if (module && !enabled) { customError(`${module} module is not activated for this facility`, 403, res); return; }
          if (creatingBranch && config.branchMode === 'single') {
               customError('This facility supports a single branch; additional branches are not enabled', 403, res);
               return;
          }
          next();
     } catch {
          logger.error('Unable to verify facility module activation', { tenantId, module, creatingBranch });
          responseError(res);
     }
}
