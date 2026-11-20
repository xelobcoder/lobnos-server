import {expect,it} from 'vitest';
import {MASTER_CATALOG_SCOPE,masterCatalogContext,scopedCatalogDatabase} from './MasterCatalogContext';
it('rejects selecting master storage without an authenticated request scope',()=>{
 expect(scopedCatalogDatabase(123)).toBeNull();
 expect(()=>scopedCatalogDatabase(MASTER_CATALOG_SCOPE)).toThrow('authentication required');
});
it('binds master requests only to master storage and isolates concurrent tenant requests',async()=>{
 const db={catalog:true};
 await Promise.all([masterCatalogContext.run({db,employeeid:7},async()=>{
   await Promise.resolve();expect(scopedCatalogDatabase(MASTER_CATALOG_SCOPE)).toBe(db);
   expect(()=>scopedCatalogDatabase(123)).toThrow('cannot access facility databases');
 }),Promise.resolve().then(()=>expect(scopedCatalogDatabase(123)).toBeNull())]);
 expect(masterCatalogContext.getStore()).toBeUndefined();
});
