import { beforeEach, describe, expect, it } from 'vitest';
import { FacilityError } from './FacilityInput';
import {
     FacilityModulePricingCatalog, MODULE_PRICING_CATALOG_TABLE, validateFacilityModulePricing,
} from './FacilityModulePricingCatalog';
import { FACILITY_MODULES } from './FacilityModules';

function memoryMaster() {
     const tables: Record<string, any[]> = {};
     let exists = false;
     const schema: any = {
          hasTable: async () => exists,
          createTable: async (name: string, define: (table: any) => void) => {
               const column: any = {
                    notNullable: () => column,
               };
               define({
                    string: () => column,
                    decimal: () => column,
                    primary: () => column,
               });
               exists = true;
          },
     };
     const db: any = (tableName: string) => {
          let pending: any[] = [];
          const conditions: Record<string, unknown> = {};
          const query: any = {
               insert(value: any) {
                    pending = Array.isArray(value) ? value : [value];
                    return query;
               },
               onConflict() {
                    return {
                         ignore: async () => {
                              const rows = tables[tableName] ||= [];
                              for (const row of pending) {
                                   if (!rows.some(current => current.currency === row.currency && current.module === row.module)) {
                                        rows.push({ ...row });
                                   }
                              }
                         },
                         merge: async () => {
                              const rows = tables[tableName] ||= [];
                              for (const row of pending) {
                                   const existing = rows.find(current => current.currency === row.currency && current.module === row.module);
                                   if (existing) existing.monthly_price = row.monthly_price;
                                   else rows.push({ ...row });
                              }
                         },
                    };
               },
               where(value: Record<string, unknown>) { Object.assign(conditions, value); return query; },
               async select() {
                    return (tables[tableName] || []).filter(row =>
                         Object.entries(conditions).every(([key, value]) => row[key] === value)).map(row => ({ ...row }));
               },
          };
          return query;
     };
     db.schema = schema;
     db.transaction = async (work: any) => work(db);
     db.table = (name: string) => tables[name] || [];
     return db;
}

const prices = (overrides: Record<string, string> = {}) => ({
     currency: 'GHS',
     modules: Object.fromEntries(FACILITY_MODULES.map(module => [module, overrides[module] ?? '0.00'])),
});

describe('facility module pricing catalog', () => {
     let master: any;
     let catalog: FacilityModulePricingCatalog;
     beforeEach(() => {
          master = memoryMaster();
          catalog = new FacilityModulePricingCatalog(master);
     });

     it('initializes a zero-priced GHS catalog and returns every supported module', async () => {
          const result = await catalog.get();
          expect(result).toEqual(prices());
          expect(master.table(MODULE_PRICING_CATALOG_TABLE)).toHaveLength(FACILITY_MODULES.length);
     });

     it('updates one currency atomically and leaves other currencies unchanged', async () => {
          await catalog.put(prices({ pharmacy: '12.5', email: '0.05' }));
          const usd = { ...prices({ pharmacy: '2.25' }), currency: 'USD' };
          await catalog.put(usd);
          expect(await catalog.get('GHS')).toEqual(prices({ pharmacy: '12.50', email: '0.05' }));
          expect(await catalog.get('USD')).toEqual({ ...prices({ pharmacy: '2.25' }), currency: 'USD' });
          expect(await catalog.getAll()).toEqual([
               prices({ pharmacy: '12.50', email: '0.05' }),
               { ...prices({ pharmacy: '2.25' }), currency: 'USD' },
          ]);
     });

     it('requires explicit catalog entries for non-GHS currencies', async () => {
          await expect(catalog.get('EUR')).rejects.toMatchObject({ statusCode: 404 });
          await catalog.put({ ...prices({ email: '5.00' }), currency: 'EUR' });
          expect(await catalog.get('EUR')).toEqual({ ...prices({ email: '5.00' }), currency: 'EUR' });
     });

     it.each([
          null,
          {},
          { ...prices(), currency: 'ghs' },
          { ...prices(), modules: { ...prices().modules, unknown: '1.00' } },
          { ...prices(), modules: Object.fromEntries(FACILITY_MODULES.slice(1).map(module => [module, '0.00'])) },
          { ...prices(), modules: { ...prices().modules, pharmacy: 5 } },
          { ...prices(), modules: { ...prices().modules, pharmacy: '-1.00' } },
          { ...prices(), modules: { ...prices().modules, pharmacy: '1.001' } },
          { ...prices(), modules: { ...prices().modules, pharmacy: '10000000000.00' } },
     ])('rejects invalid catalog input %j', value => {
          expect(() => validateFacilityModulePricing(value)).toThrow(FacilityError);
     });
});
