import ApplicationSettings from '../../appsettings/appset';
import { validateModuleConfiguration } from '../../../Tenancy/FacilityModules';

export async function isEmailModuleActivated(tenantId: number): Promise<boolean> {
     const settings = await new ApplicationSettings().getAllAppSettings(tenantId);
     if (!settings) return false;
     if (settings.moduleConfiguration) {
          const config = validateModuleConfiguration(JSON.parse(settings.moduleConfiguration));
          if (!config) throw new Error('Invalid stored module configuration');
          return config.modules.email.enabled;
     }

     const explicitFlag = Number((settings as any).emailModuleActivated ?? 0);
     if (explicitFlag === 1) return true;

     const connectedServices = settings.services as any;
     if (connectedServices && typeof connectedServices === 'object') {
          return Number(connectedServices.isEmailServicesConnected ?? 0) === 1;
     }

     return false;
}

export async function ensureEmailModuleActivated(tenantId: number): Promise<void> {
     const activated = await isEmailModuleActivated(tenantId);
     if (!activated) {
          throw new Error('Email module is not activated.');
     }
}
