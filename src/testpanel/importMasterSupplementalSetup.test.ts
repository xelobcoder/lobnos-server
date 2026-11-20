import {afterEach,beforeEach,expect,it} from 'vitest';
import {accountingSqlDatabase} from '../testSupport/accountingSqlDatabase';
import {importMasterSupplementalSetup} from './importMasterSupplementalSetup';
let fixture:ReturnType<typeof accountingSqlDatabase>;
beforeEach(()=>{fixture=accountingSqlDatabase();fixture.native.exec('CREATE TABLE field_constraints(id INTEGER PRIMARY KEY,testid INTEGER,fieldid INTEGER,action TEXT); CREATE TABLE proceduremanual(id INTEGER PRIMARY KEY,testid INTEGER,title TEXT,proceduremanual TEXT,createdby INTEGER); CREATE TABLE test_report_settings(id INTEGER PRIMARY KEY,testid INTEGER,resultsettings TEXT); CREATE TABLE calculated_parameter_formulas(id INTEGER PRIMARY KEY,testid INTEGER,output_field_id INTEGER,input_parameters TEXT,expression TEXT,created_by INTEGER); CREATE TABLE test_results(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO test_results VALUES(1,\'145 g/L\')');});
afterEach(()=>fixture.db.destroy());
it('remaps parameter references and imports manuals, report settings and formulas without modifying historical results',async()=>{
 await importMasterSupplementalSetup(fixture.db,{field_constraints:[{id:1,testid:10,fieldid:7,action:'hide'}],proceduremanual:[{id:1,testid:10,title:'Manual',proceduremanual:'Procedure',createdby:99}],test_report_settings:[{id:1,testid:10,resultsettings:{title:'Lab'}}],calculated_parameter_formulas:[{id:1,testid:10,output_field_id:8,input_parameters:[{fieldId:7,token:'hb'}],expression:'hb * 2',created_by:99}]},20,new Map([[7,70],[8,80]]),3);
 expect(await fixture.db('field_constraints').first()).toMatchObject({testid:20,fieldid:70});
 expect(await fixture.db('proceduremanual').first()).toMatchObject({testid:20,createdby:3});
 const formula=await fixture.db('calculated_parameter_formulas').first();expect(formula.output_field_id).toBe(80);expect(JSON.parse(formula.input_parameters)[0].fieldId).toBe(70);
 expect((await fixture.db('test_results').first()).value).toBe('145 g/L');
});
it('rejects configuration referencing an unmapped master parameter',async()=>{await expect(importMasterSupplementalSetup(fixture.db,{field_constraints:[{testid:10,fieldid:999}]},20,new Map(),3)).rejects.toThrow('missing parameter')});
