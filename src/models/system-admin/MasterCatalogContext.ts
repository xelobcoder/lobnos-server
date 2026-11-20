import {AsyncLocalStorage} from 'node:async_hooks';

// A request-local scope, established only after dedicated master-session authentication.
// No real tenant ID can select the catalogue, and a scoped request cannot fall through to a tenant DB.
export const MASTER_CATALOG_SCOPE = 2147483646;
export const masterCatalogContext = new AsyncLocalStorage<{db:any;employeeid:number}>();
export function scopedCatalogDatabase(tenantId:number) {
    const scope=masterCatalogContext.getStore();
    if (!scope) {
        if(Number(tenantId)===MASTER_CATALOG_SCOPE)throw new Error('Master catalogue authentication required');
        return null;
    }
    if(Number(tenantId)!==MASTER_CATALOG_SCOPE)throw new Error('Master catalogue requests cannot access facility databases');
    return scope.db;
}
