import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {MasterCatalogService} from './MasterCatalogService';
let fixture:ReturnType<typeof accountingSqlDatabase>, service:MasterCatalogService;
beforeEach(async()=>{fixture=accountingSqlDatabase();fixture.native.exec(`
 CREATE TABLE master_catalog_sequences(key TEXT PRIMARY KEY,value INTEGER);INSERT INTO master_catalog_sequences VALUES('write_lock',0);
 CREATE TABLE master_catalog_audit(id INTEGER PRIMARY KEY,actor_id INTEGER,action TEXT,module TEXT,testid INTEGER,recordid INTEGER,before_data TEXT,after_data TEXT);
 CREATE TABLE test_panels(prim_key INTEGER PRIMARY KEY,id INTEGER,name TEXT,category INTEGER,sample INTEGER,sample_container INTEGER,price INTEGER,unit TEXT);
 CREATE TABLE departments(id INTEGER PRIMARY KEY,department TEXT);INSERT INTO departments VALUES(1,'Hematology');
 CREATE TABLE sampletype(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO sampletype VALUES(1,'Blood');
 CREATE TABLE samplecontainer(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO samplecontainer VALUES(1,'EDTA');
 CREATE TABLE testcreationrules(id INTEGER PRIMARY KEY,testid INTEGER,name TEXT,field TEXT,plan TEXT,units TEXT,categoryid INTEGER);
 CREATE TABLE testdetailcategory(categoryid INTEGER PRIMARY KEY,testid INTEGER,categoryname TEXT,deleted INTEGER DEFAULT 0);
 CREATE TABLE field_constraints(id INTEGER PRIMARY KEY,testid INTEGER,fieldid INTEGER,action TEXT);
 CREATE TABLE calculated_parameter_formulas(id INTEGER PRIMARY KEY,testid INTEGER,output_field_id INTEGER,input_parameters TEXT);
 CREATE TABLE testdetails(id INTEGER PRIMARY KEY,testid INTEGER,testcost INTEGER,testprice INTEGER,updatedby INTEGER,childrenlimit TEXT,instrumentation TEXT);CREATE TABLE setupliteraturereview(id INTEGER PRIMARY KEY,testid INTEGER,literature TEXT);CREATE TABLE test_results(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO test_results VALUES(1,'145 g/L');
 `);service=new MasterCatalogService(fixture.db);vi.spyOn(service,'ensure').mockResolvedValue();vi.spyOn(service,'fields').mockImplementation(async name=>{const table:any={panels:'test_panels',parameters:'testcreationrules',groups:'testdetailcategory',constraints:'field_constraints'};const info=await fixture.db(table[name]).columnInfo();return Object.keys(info).map(key=>({name:key,type:key==='price'?'int':'varchar',auto:key==='id'&&name!=='panels'||key==='categoryid'&&name==='groups',required:false,default:null,choices:key==='plan'?['input','options']:null}))});});
afterEach(()=>fixture.db.destroy());
const panel=()=>service.save('panels',{name:'QA Master FBC',category:1,sample:1,sample_container:1,price:40,unit:'mL'},7);
it('creates and edits master panels and parameters, audits writes and preserves unrelated results',async()=>{
 const created=await panel();const parameter=await service.save('parameters',{name:'Hemoglobin',plan:'input',units:'g/L'},7,created.id);
 expect(parameter).toMatchObject({testid:created.id,field:'Hemoglobin'});
 await service.save('parameters',{name:'Haemoglobin',plan:'input',units:'g/L'},7,created.id,parameter.id);
 expect((await fixture.db('testcreationrules').first()).name).toBe('Haemoglobin');
 await service.remove('panels',created.id,7);
 expect(await fixture.db('testcreationrules')).toHaveLength(0);expect(await fixture.db('master_catalog_audit')).toHaveLength(4);
 expect((await fixture.db('test_results').first()).value).toBe('145 g/L');
 const again=await panel();expect(again.id).toBeGreaterThan(created.id);
});
it('rejects unknown tables, arbitrary IDs, duplicate panels and cross-panel edits',async()=>{
 await expect(service.save('roles',{role:'admin'},7)).rejects.toMatchObject({statusCode:404});
 const created=await panel();await expect(panel()).rejects.toMatchObject({statusCode:409});
 await expect(service.save('panels',{id:999,name:'Bad'},7)).rejects.toMatchObject({statusCode:400});
 const other=await service.save('panels',{name:'QA Other',category:1,sample:1,sample_container:1,price:1,unit:'mL'},7);
 const field=await service.save('parameters',{name:'One',plan:'input'},7,created.id);
 await expect(service.save('parameters',{name:'Wrong scope'},7,other.id,field.id)).rejects.toMatchObject({statusCode:404});
});
it('validates category and parameter ownership in master groups and conditions',async()=>{
 const created=await panel();
 await expect(service.save('parameters',{name:'Bad',plan:'input',categoryid:999},7,created.id)).rejects.toMatchObject({statusCode:400});
 await expect(service.save('constraints',{fieldid:999,action:'hide'},7,created.id)).rejects.toMatchObject({statusCode:400});
});
