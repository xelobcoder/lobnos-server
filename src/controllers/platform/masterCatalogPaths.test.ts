import {expect,it} from 'vitest';
import {allowedMasterCatalogPath} from './masterCatalogPaths';
it('allows shared test configuration contracts and denies clinical, tenant and authentication operations',()=>{
 for(const path of ['/testpanel/unit-catalogue','/testpanel/list','/gettestpanel/edit','/testpanel/calculations','/test/fields/category/test/100259','/multi/definition/conditions/3','/operations/control/tests/100259/critical-policies/4'])expect(allowedMasterCatalogPath(path),path).toBe(true);
 for(const path of ['/billing','/test/result','/prime/login','/testpanel/staff-access','/platform/facilities','/testpanel/list/../../patients','/testpanel/list%2F..%2Fpatients','/testpanel/list/bulk'])expect(allowedMasterCatalogPath(path),path).toBe(false);
});
