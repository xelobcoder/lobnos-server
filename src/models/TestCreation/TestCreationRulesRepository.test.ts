import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
const context=vi.hoisted(()=>({db:null as any}));
vi.mock('../../database/KnexConnections',()=>({default:async()=>context.db}));
import Repository from './TestCreationRulesRepository';
let fixture:ReturnType<typeof accountingSqlDatabase>,repo:Repository;
beforeEach(async()=>{
 fixture=accountingSqlDatabase();context.db=fixture.db;
 await fixture.db.schema.createTable('test_panels',t=>{t.integer('id').primary()});
 await fixture.db('test_panels').insert([{id:10},{id:20}]);
 await fixture.db.schema.createTable('testcreationrules',t=>{t.increments('id');t.integer('testid');t.string('name').notNullable();t.string('plan').notNullable();t.boolean('isRequired').defaultTo(false);t.string('result_type');t.string('reference_mode');t.string('unit_code');
 for(const key of ['field','value','hasunits','units','plain','ordering','isValueTracked','textReference','upperlimit','lowerlimit','category','options','undercategory','categoryid','valueAlert','alert','upperLimitFemale','lowerLimitFemale','upperLimitMale','lowerLimitMale','upperLimitChildren','lowerLimitChildren','upperLimitNeonates','lowerLimitNeonates'])t.string(key);
 });
 await fixture.db.schema.createTable('test_results',t=>{t.increments('id');t.integer('fieldid');t.string('field');t.string('value')});
 await fixture.db('testcreationrules').insert({id:7,testid:10,name:'Hemoglobin',plan:'limits',lowerlimit:'0',upperlimit:'170',isRequired:0});
 await fixture.db('test_results').insert({id:6,fieldid:7,field:'Hemoglobin',value:'145 g/L'});
 repo=new Repository(123);
});
afterEach(()=>fixture.db.destroy());
it('renaming preserves parameter identity and historical result bytes',async()=>{
 const before=await fixture.db('test_results').first();
 expect(await repo.create([{id:7,testid:10,name:'Haemoglobin',plan:'limits'}],10)).toEqual([7]);
 expect(await fixture.db('testcreationrules').where({id:7}).first()).toMatchObject({name:'Haemoglobin'});
 expect(await fixture.db('test_results').first()).toEqual(before);
});
it('rolls back the entire list when a later write fails',async()=>{
 const before=await fixture.db('testcreationrules').select('*');
 await expect(repo.create([{id:7,testid:10,name:'Changed',plan:'limits'},{testid:10,name:'Invalid',plan:null} as any],10)).rejects.toThrow();
 expect(await fixture.db('testcreationrules').select('*')).toEqual(before);
});
it('persists required and zero limits and reloads them',async()=>{
 await repo.create([{id:7,testid:10,name:'Hemoglobin',plan:'limits',isRequired:true,lowerlimit:0,upperlimit:0} as any],10);
 const row=(await repo.findByTestId(10))[0];expect(row.isRequired).toBe(1);expect(Number(row.lowerlimit)).toBe(0);expect(Number(row.upperlimit)).toBe(0);
});
it('rejects an ID from another panel without changing either panel',async()=>{
 await fixture.db('testcreationrules').insert({id:8,testid:20,name:'Other',plan:'input'});
 await expect(repo.create([{id:8,testid:10,name:'Stolen',plan:'input'}],10)).rejects.toThrow();
 expect(await fixture.db('testcreationrules').where({id:7}).first()).toBeTruthy();
 expect(await fixture.db('testcreationrules').where({id:8}).first()).toMatchObject({testid:20,name:'Other'});
});

it('adding separated settings preserves every existing legacy parameter and historical result',async()=>{
 const before=await fixture.db('testcreationrules').where({id:7}).first(),history=await fixture.db('test_results').first();
 await repo.create([before,{testid:10,name:'QA Numeric',plan:'input',result_type:'numeric',reference_mode:'interval',lowerlimit:'0',upperlimit:'10',units:'custom-unit',unit_code:null} as any],10);
 expect(await fixture.db('testcreationrules').where({id:7}).first()).toEqual(before);
 expect(await fixture.db('test_results').first()).toEqual(history);
 expect(await fixture.db('testcreationrules').where({name:'QA Numeric'}).first()).toMatchObject({result_type:'numeric',reference_mode:'interval',plan:'limits',lowerlimit:'0',upperlimit:'10',units:'custom-unit'});
});
