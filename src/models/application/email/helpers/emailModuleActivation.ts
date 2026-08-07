import ApplicationSettings from '../../appsettings/appset';

export async function isEmailModuleActivated(tenantId: number): Promise<boolean> {
     const settings = await new ApplicationSettings().getAllAppSettings(tenantId);
     if (!settings) return false;

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
