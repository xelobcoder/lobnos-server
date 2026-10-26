/** Marketers use aggregate CRM data, not patient records, payouts or clinical operations. */
export function marketerRouteAllowed(method: string, path: string): boolean {
     const route = path.replace(/\/+$/, '');
     if (method === 'GET' && route === '/api/v1/prime/my-roles') return true;
     if (method === 'POST' && route === '/api/v1/prime/switch-role') return true;
     if (method === 'POST' && route === '/api/v1/prime/refresh-role-session') return true;
     if (/^\/api\/v1\/(crm|leads|followups)(\/|$)/.test(route)) return true;
     if (method === 'GET' && ['/api/v1/prime/validate-token', '/api/v1/settings/companyprofile/images', '/api/v1/notifications/inbox', '/api/v1/notifications/inbox/unread-count'].includes(route)) return true;
     if (method === 'PATCH' && /^\/api\/v1\/notifications\/inbox\/\d+\/read$/.test(route)) return true;
     return method === 'POST' && route === '/api/v1/logins/logout';
}
