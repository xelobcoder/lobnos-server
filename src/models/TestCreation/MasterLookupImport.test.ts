import {afterEach,beforeEach,expect,it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {MasterLookupImport} from './MasterLookupImport';
let source:ReturnType<typeof accountingSqlDatabase>,destination:ReturnType<typeof accountingSqlDatabase>;
beforeEach(()=>{source=accountingSqlDatabase();destination=accountingSqlDatabase();for(const fixture of [source,destination])fixture.native.exec(`CREATE TABLE sampletype(id INTEGER PRIMARY KEY,name TEXT);CREATE TABLE departments(id INTEGER PRIMARY KEY,department TEXT,departmentManager TEXT,employeeid INTEGER);CREATE TABLE samplecontainer(id INTEGER PRIMARY KEY,name TEXT,description TEXT,volume_capacity REAL,material TEXT,color TEXT,is_reusable BOOLEAN);`);});
afterEach(async()=>{await source.db.destroy();await destination.db.destroy();});
it('previews duplicates and container conflicts and never overwrites a facility record',async()=>{
 await source.db('samplecontainer').insert([{id:100,name:'EDTA',volume_capacity:5,color:'Purple'},{id:101,name:'QA Tube',volume_capacity:2,color:'Blue'}]);
 await destination.db('samplecontainer').insert({id:9,name:'edta',volume_capacity:4,color:'Purple'});
 const service=new MasterLookupImport(source.db,destination.db);
 expect((await service.preview('containers')).map(row=>row.status)).toEqual(['conflict','new']);
 expect(await service.apply('containers',[100,101],7)).toEqual({imported:1,skipped:1});
 expect(await destination.db('samplecontainer').where({id:9}).first()).toMatchObject({volume_capacity:4});
 expect(await service.apply('containers',[101],7)).toEqual({imported:0,skipped:1});
});
it('imports all lookup kinds with facility-local IDs and staff attribution',async()=>{
 await source.db('sampletype').insert({id:100,name:'QA Blood'});await source.db('departments').insert({id:100,department:'QA Lab',departmentManager:'Source staff',employeeid:999});
 const service=new MasterLookupImport(source.db,destination.db);await service.apply('samples',[100],7);await service.apply('departments',[100],7);
 expect(await destination.db('sampletype').first()).toMatchObject({id:1,name:'QA Blood'});
 expect(await destination.db('departments').first()).toMatchObject({id:1,employeeid:7,departmentManager:'System Import'});
});
it('normalizes whitespace and rejects missing or invalid source IDs without partial imports',async()=>{
 await source.db('sampletype').insert({id:100,name:'  Whole   Blood '});await destination.db('sampletype').insert({name:'whole blood'});
 const service=new MasterLookupImport(source.db,destination.db);expect((await service.preview('samples'))[0].status).toBe('existing');
 expect(await service.apply('samples',[100],7)).toEqual({imported:0,skipped:1});await expect(service.apply('samples',[100,999],7)).rejects.toMatchObject({statusCode:409});await expect(service.apply('invalid',[100],7)).rejects.toMatchObject({statusCode:400});
});
