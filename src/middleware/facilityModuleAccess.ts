import { Request, Response, NextFunction } from 'express';
import KnexConnection from '../database/KnexConnections';
import { systemConfigConnection } from '../database/connection';
import { configuration } from '../hooks/configuration';
import { customError, responseError } from '../hooks/helper';
import logger from '../hooks/logger';
import TokenValidator from '../models/settings/users/TokenValidator';
import { isSuperAdminRole } from './roles';

const readCookie = (cookieHeader: unknown, name: string): string | undefined => {
     const match = String(cookieHeader || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
     return match ? match.slice(name.length + 1) : undefined;
};
import {
     ADDITIONAL_FACILITY_MODULES, FacilityModule, MODULE_CONFIG_TABLE, validateModuleConfiguration,
} from '../models/Tenancy/FacilityModules';

export function moduleForApiPath(path: string): FacilityModule | null {
     if (/^\/api\/v1\/pharmacy(?:\/|$)/i.test(path)) return 'pharmacy';
     if (/^\/api\/v1\/inventory(?:\/|$)/i.test(path)) return 'inventory';
     if (/^\/api\/v1\/email(?:\/|$)/i.test(path)) return 'email';
     if (/^\/api\/v1\/(?:sms(?:\/|$)|prime\/sms(?:[-/]|$))/i.test(path)) return 'sms';
     if (/^\/api\/v1\/(?:applicationsettings\/smsupdate|application\/sms\/create\/template\/columns)(?:\/|$)/i.test(path)) return 'sms';
     if (/^\/api\/v1\/(?:interfacing\/devices|devices\/interfacing)(?:\/|$)/i.test(path)) return 'deviceInterfacing';
     if (/^\/api\/v1\/(?:commission(?:-payments)?)(?:\/|$)/i.test(path)) return 'commissions';
     if (/^\/api\/v1\/appointments?(?:\/|$)/i.test(path)) return 'appointments';
     if (/^\/api\/v1\/expenses?(?:\/|$)/i.test(path) ||
          /^\/api\/v1\/(?:outsourced\/cases\/mark-expense|supplier-payments\/mark-expense)(?:\/|$)/i.test(path)) return 'expenses';
     if (/^\/api\/v1\/consultation\/(?:encounters|pending)(?:\/|$)/i.test(path)) return 'consultations';
     if (/^\/api\/v1\/(?:entityorders|consultation\/catalogue)(?:\/|$)/i.test(path)) return 'laboratoryOperations';
     if (/^\/api\/v1\/prescriptions(?:\/|$)/i.test(path)) return 'pharmacy';
     if (/^\/api\/v1\/records\/consul(?:t)?ations?(?:\/|$)/i.test(path)) return 'consultations';
     if (/^\/api\/v1\/(?:operations\/imaging|ultrasound|testpanel\/list\/ultrasound|result\/entry\/ultrasound)(?:\/|$)/i.test(path)) return 'imaging';
     if (/^\/api\/v1\/(?:analytics|patient-analytics|patient\/individual\/analytics|clinician\/anal|testascension|ascension\/analytics|ascension\/phelobotomistAnalyticsSummary)(?:\/|$)/i.test(path) ||
          /^\/api\/v1\/financials\/billing\/summary(?:\/|$)/i.test(path) ||
          /^\/api\/v1\/outsourced\/(?:profit-per-test|profit-by-case|cases(?:-profit)?)(?:\/|$)/i.test(path)) return 'analytics';
     return null;
}

/** The super admin may use every module regardless of facility activation. Requires a valid, unexpired session token. */
async function isSuperAdminRequest(req: Request): Promise<boolean> {
     try {
          const headers = req.headers || {};
          const token = headers['pls-prime-tenant-session'] || readCookie(headers['cookie'], 'pls-prime-tenant-session');
          if (!token) return false;
          const validator = new TokenValidator();
          const status = await validator.validateAccessToken(token.toString()) as { expired?: boolean };
          if (status?.expired !== false) return false;
          const decoded = await validator.decodeAccessToken(token.toString());
          if (decoded?.clientType === 'device-manager') return false;
          return isSuperAdminRole(decoded?.role);
     } catch {
          return false;
     }
}

export async function facilityModuleAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
     const module = moduleForApiPath(req.path);
     const creatingBranch = req.method === 'POST' && /^\/api\/v1\/branches\/?$/i.test(req.path);
     if (!module && !creatingBranch) { next(); return; }
     const tenantId = Number(req.query.tenantId);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { customError('Invalid tenantId', 400, res); return; }
     if (await isSuperAdminRequest(req)) { next(); return; }
     try {
          const db = await KnexConnection(tenantId);
          const settings = await db('applicationsettings').where({ keyid: 1 }).first();
          if (module === 'sms') {
               if (configuration.isMultiTenant) {
                    const platformRow = await systemConfigConnection(MODULE_CONFIG_TABLE)
                         .where({ tenant_id: tenantId }).first('configuration');
                    if (!platformRow) {
                         customError('sms module is not authorized for this tenant', 403, res);
                         return;
                    }
                    const platformConfig = validateModuleConfiguration(JSON.parse(platformRow.configuration));
                    if (!platformConfig?.modules.sms.enabled) {
                         customError('sms module is not authorized for this tenant', 403, res);
                         return;
                    }
               } else if (settings?.moduleConfiguration) {
                    const localConfig = validateModuleConfiguration(JSON.parse(settings.moduleConfiguration));
                    if (!localConfig?.modules.sms.enabled) {
                         customError('sms module is not authorized for this tenant', 403, res);
                         return;
                    }
               }
               if (Number(settings?.smsActivated) !== 1) {
                    customError('sms module is not activated for this facility', 403, res);
                    return;
               }
               next();
               return;
          }
          if (module && (ADDITIONAL_FACILITY_MODULES as readonly string[]).includes(module)) {
               // New module routes do not inherit the permissive no-config behavior
               // used to keep pre-subscription legacy facilities working.
               if (configuration.isMultiTenant) {
                    const platformRow = await systemConfigConnection(MODULE_CONFIG_TABLE)
                         .where({ tenant_id: tenantId }).first('configuration');
                    if (!platformRow) {
                         customError(`${module} module is not authorized for this tenant`, 403, res);
                         return;
                    }
                    const platformConfig = validateModuleConfiguration(JSON.parse(platformRow.configuration));
                    if (!platformConfig?.modules[module].enabled) {
                         customError(`${module} module is not authorized for this tenant`, 403, res);
                         return;
                    }
               }
               if (!settings?.moduleConfiguration) {
                    customError(`${module} module is not activated for this facility`, 403, res);
                    return;
               }
               const localConfig = validateModuleConfiguration(JSON.parse(settings.moduleConfiguration));
               if (!localConfig?.modules[module].enabled) {
                    customError(`${module} module is not activated for this facility`, 403, res);
                    return;
               }
               next();
               return;
          }
          if (!settings?.moduleConfiguration) {
               next();
               return;
          }
          const config = validateModuleConfiguration(JSON.parse(settings.moduleConfiguration));
          if (!config) throw new Error('Invalid stored module configuration');
          const enabled = module && config.modules[module].enabled;
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
