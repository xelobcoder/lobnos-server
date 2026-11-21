import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
vi.mock('../../models/TestCreation/parameterSchema',()=>({ensureParameterDefinitionSchema:vi.fn()}));
vi.mock('../../models/results/ResultSafetySchema',()=>({ensureResultSafetySchema:vi.fn()}));
vi.mock('../../middleware/authority',()=>({getAuthUser:()=>({employeeid:9})}));
import KnexConnection from '../../database/KnexConnections';
import {putReportValidation,getReportValidation} from './reportValidationHandlers';
let fixture:ReturnType<typeof accountingSqlDatabase>;
beforeEach(()=>{fixture=accountingSqlDatabase();fixture.native.exec(`CREATE TABLE test_panels(id INTEGER PRIMARY KEY); INSERT INTO test_panels VALUES(1);
CREATE TABLE testcreationrules(id INTEGER PRIMARY KEY,testid INTEGER,name TEXT,units TEXT,result_type TEXT,plan TEXT,linearity_enabled BOOLEAN DEFAULT 0,linearity_lower REAL,linearity_upper REAL);
INSERT INTO testcreationrules(id,testid,name,units,result_type,plan)VALUES(10,1,'Hb','g/L','numeric','input'),(20,2,'Foreign','g/L','numeric','input');
CREATE TABLE pls_delta_rules(id INTEGER PRIMARY KEY,testid INTEGER,fieldid INTEGER,window_hours INTEGER,max_absolute REAL,max_percent REAL,action TEXT,active BOOLEAN,created_by INTEGER,created_at TEXT,updated_at TEXT);
CREATE TABLE test_results(id INTEGER PRIMARY KEY,fieldid INTEGER,value TEXT,units TEXT);INSERT INTO test_results VALUES(1,10,'145','g/L');`);vi.mocked(KnexConnection).mockResolvedValue(fixture.db);});
afterEach(async()=>fixture.db.destroy());
async function call(handler:any,body:any={}){const response:any={statusCode:200,status(n:number){this.statusCode=n;return this;},json(data:any){this.data=data;return this;}};await handler({params:{testid:'1'},query:{tenantId:'123456'},body},response);return response;}
it('atomically saves bounds and delta limits, persists zero and leaves historical measurements unchanged',async()=>{
 expect((await call(putReportValidation,{rules:[{fieldid:10,linearity_enabled:true,linearity_lower:0,linearity_upper:200,delta_enabled:true,max_percent:20,window_hours:24,action:'block'}]})).data.success).toBe(true);
 expect((await call(getReportValidation)).data.data[0]).toMatchObject({fieldid:10,linearity_lower:0,linearity_upper:200,delta_enabled:1,max_percent:20});
 expect(await fixture.db('test_results').first()).toMatchObject({value:'145',units:'g/L'});
});
it('rolls the whole change back when a later parameter belongs to another panel',async()=>{
 const response=await call(putReportValidation,{rules:[{fieldid:10,linearity_enabled:true,linearity_lower:0,linearity_upper:200},{fieldid:20}]});
 expect(response.statusCode).toBe(400);expect(await fixture.db('testcreationrules').where({id:10}).first()).toMatchObject({linearity_enabled:0,linearity_lower:null});expect(await fixture.db('pls_delta_rules')).toHaveLength(0);
});
it('rejects duplicate parameter identities and invalid bounds before changing records',async()=>{
 expect((await call(putReportValidation,{rules:[{fieldid:10},{fieldid:10}]})).statusCode).toBe(400);
 expect((await call(putReportValidation,{rules:[{fieldid:10,linearity_enabled:true,linearity_lower:10,linearity_upper:0}]})).statusCode).toBe(400);
});
