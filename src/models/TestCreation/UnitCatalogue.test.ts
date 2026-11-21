import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
const context=vi.hoisted(()=>({db:null as any}));
vi.mock('../../database/connection',()=>({systemConfigConnection:new Proxy(()=>{}, {apply:(_t,_this,args)=>context.db(...args),get:(_t,key)=>context.db[key]})}));
import {listUnits,addUnit,unitForSave} from './UnitCatalogue';
let fixture:ReturnType<typeof accountingSqlDatabase>;
beforeAll(()=>{fixture=accountingSqlDatabase();context.db=fixture.db});afterAll(()=>fixture.db.destroy());
it('serves one canonical catalogue, accepts aliases without rewriting them and preserves custom units',async()=>{
 const units=await listUnits();expect(units.length).toBeGreaterThan(40);
 expect(units.find(row=>row.code==='s')?.aliases).toContain('sec');
 const legacy={units:'sec',unit_code:'s'};expect(await unitForSave(legacy)).toEqual({unit_code:'s'});expect(legacy.units).toBe('sec');
 expect(await unitForSave({units:'local-unit'})).toEqual({});
 await expect(unitForSave({units:'g/L',unit_code:'mg/dL'})).rejects.toThrow();
});
it('new owner-created units are available through that same catalogue and codes cannot be overwritten',async()=>{
 await addUnit({code:'qa_unit',symbol:'QA-U',label:'QA verification unit'});
 expect((await listUnits()).find(row=>row.code==='qa_unit')).toMatchObject({symbol:'QA-U'});
 await expect(addUnit({code:'qa_unit',symbol:'DIFFERENT',label:'Overwrite'})).rejects.toThrow('already exists');
});
