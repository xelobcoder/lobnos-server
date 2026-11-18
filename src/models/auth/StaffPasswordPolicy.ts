export const STAFF_PASSWORD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function staffPasswordChangeRouteAllowed(method: string, path: string): boolean {
     const normalizedPath = String(path || '').toLowerCase().replace(/\/+$/, '');
     return (method.toUpperCase() === 'POST' && normalizedPath === '/api/v1/prime/change-password') ||
          (method.toUpperCase() === 'GET' && normalizedPath === '/api/v1/prime/validate-token');
}

export function isStaffPasswordExpired(passwordChangedOn: unknown, now = Date.now()): boolean {
     if (passwordChangedOn == null || passwordChangedOn === '') return false;
     const changedAt = passwordChangedOn instanceof Date
          ? passwordChangedOn.getTime()
          : new Date(String(passwordChangedOn)).getTime();
     return Number.isFinite(changedAt) && now - changedAt >= STAFF_PASSWORD_MAX_AGE_MS;
}
