export const DEVICE_MANAGER_SESSION_PREFIX = 'device-manager:';
export type StaffClientType = 'standard' | 'device-manager';

export function deviceManagerRouteAllowed(method: string, path: string): boolean {
     return (method === 'GET' && [
          '/api/v1/interfacing/devices',
          '/api/v1/interfacing/devices/license',
          '/api/v1/interfacing/devices/session',
     ].includes(path)) ||
          (method === 'POST' && [
               '/api/v1/interfacing/devices/receiving/data',
               '/api/v1/logins/logout',
          ].includes(path));
}
