import { systemConfigConnection } from '../../database/connection';
import { FacilityError } from '../Tenancy/FacilityInput';
import { applyTestPanelsAfterInsert } from '../../database/appLevelTriggers';
import { validateFormula } from '../creator/calculations/FormulaEngine';

export const catalogModules = {
 panels: {table:'test_panels',key:'id',label:'Test panels'},
 parameters: {table:'testcreationrules',key:'id',label:'Parameters'},
 groups: {table:'testdetailcategory',key:'categoryid',label:'Parameter groups'},
 details: {table:'testdetails',key:'id',label:'Test details'},
 conditionGroups: {table:'testconditiondefinitions',key:'id',label:'Conditional result groups'},
 conditions: {table:'testconditions',key:'id',label:'Conditional result rules'},
 constraints: {table:'field_constraints',key:'id',label:'Parameter conditions'},
 literature: {table:'setupliteraturereview',key:'id',label:'Literature'},
 templates: {table:'customtestcreation',key:'id',label:'Custom report templates'},
 procedures: {table:'proceduremanual',key:'id',label:'Procedure manual'},
 reports: {table:'test_report_settings',key:'id',label:'Report settings'},
 calculations: {table:'calculated_parameter_formulas',key:'id',label:'Calculated parameters'},
 departments: {table:'departments',key:'id',label:'Departments'},
 samples: {table:'sampletype',key:'id',label:'Sample types'},
 containers: {table:'samplecontainer',key:'id',label:'Sample containers'},
} as const;
const requiredText = new Set(['name','department','categoryname','conditionName','plan','action','constraint_type','expression']);
const singletons = new Set(['details','literature','procedures','reports','templates']);
const globals = new Set(['panels','departments','samples','containers']);
const hidden = new Set(['prim_key','testid','created_on','created_at','updated_at','updated_on','updatedon','addedon','createdby','created_by','updatedby','updated_by','createdon','date','employeeid','deleted']);
const fail = (message:string, code=400):never => {throw new FacilityError(message,code)};
const positive = (value:any) => {const id=Number(value);if(!Number.isSafeInteger(id)||id<1)fail('A valid test or record ID is required');return id};
export class MasterCatalogService {
 constructor(private db:any=systemConfigConnection){}
 private ready:Promise<void>|null=null;
 async ensure(){if(!this.ready)this.ready=this.bootstrap().catch(error=>{this.ready=null;throw error});return this.ready;}
 private async bootstrap(){
  if(!await this.db.schema.hasColumn('test_panels','requires_qc'))await this.db.schema.alterTable('test_panels',(t:any)=>t.boolean('requires_qc').notNullable().defaultTo(false));
  if(!await this.db.schema.hasTable('lab_critical_policies'))await this.db.schema.createTable('lab_critical_policies',(t:any)=>{t.integer('rule_id').primary();t.integer('testid').notNullable();t.text('actions').notNullable();t.integer('version').defaultTo(1);t.integer('updated_by');t.datetime('updated_at')});
  if(!await this.db.schema.hasTable('lab_control_audit'))await this.db.schema.createTable('lab_control_audit',(t:any)=>{t.increments('id');t.string('entity',60);t.integer('entity_id');t.string('action',60);t.integer('employeeid');t.text('reason');t.text('metadata');t.datetime('created_at')});

  // Master catalog writes use the same application-level initialization as tenant test creation.
  // Legacy master triggers omit mandatory columns and overwrite explicitly allocated catalogue IDs.
  for(const trigger of ['testidgeneration','afinliteraturereview','inserttestdetails','ontestdelete'])await this.db.raw('DROP TRIGGER IF EXISTS ??',[trigger]);
  if(!await this.db.schema.hasTable('customtestcreation'))await this.db.schema.createTable('customtestcreation',(t:any)=>{t.increments('id');t.integer('testid').notNullable().unique();t.text('creationrule','longtext').nullable();t.datetime('createdon').defaultTo(this.db.fn.now());t.datetime('updatedon').nullable()});

  if(!await this.db.schema.hasTable('master_catalog_sequences'))await this.db.schema.createTable('master_catalog_sequences',(t:any)=>{t.string('key',80).primary();t.bigInteger('value').notNullable()});
  await this.db('master_catalog_sequences').insert({key:'write_lock',value:0}).onConflict('key').ignore();
  if(!await this.db.schema.hasTable('master_catalog_audit'))await this.db.schema.createTable('master_catalog_audit',(t:any)=>{t.increments('id');t.integer('actor_id').notNullable();t.string('action',20).notNullable();t.string('module',40).notNullable();t.integer('testid').nullable();t.integer('recordid').notNullable();t.text('before_data').nullable();t.text('after_data').nullable();t.timestamp('created_at').defaultTo(this.db.fn.now())});
  if(!await this.db.schema.hasTable('proceduremanual'))await this.db.schema.createTable('proceduremanual',(t:any)=>{t.increments('id');t.integer('testid').notNullable().unique();t.string('title',255).notNullable();t.text('proceduremanual','longtext').notNullable();t.integer('createdby').nullable();t.integer('updatedby').nullable()});
  if(!await this.db.schema.hasTable('calculated_parameter_formulas'))await this.db.schema.createTable('calculated_parameter_formulas',(t:any)=>{t.increments('id');t.integer('testid').notNullable();t.integer('output_field_id').notNullable();t.text('expression').notNullable();t.json('input_parameters').notNullable();t.string('unit',64).nullable();t.integer('decimal_precision').notNullable().defaultTo(2);t.json('conditions').nullable();t.integer('version').notNullable().defaultTo(1);t.date('effective_from').notNullable();t.date('effective_to').nullable();t.boolean('active').notNullable().defaultTo(true);t.integer('created_by').nullable();t.timestamp('created_at').defaultTo(this.db.fn.now());t.unique(['testid','output_field_id','version'],'uq_master_formula_version')});
 }
 private module(name:string){if(!Object.prototype.hasOwnProperty.call(catalogModules,name))return fail('Unknown catalogue section',404);return catalogModules[name as keyof typeof catalogModules]}
 async fields(name:string){const module=this.module(name);const [columns]=await this.db.raw('SHOW FULL COLUMNS FROM ??',[module.table]);return columns.map((c:any)=>({name:c.Field,type:c.Type,required:c.Null==='NO'&&c.Default==null&&!String(c.Extra).includes('auto_increment')&&(!/^(?:varchar|text|longtext)/.test(c.Type)||requiredText.has(c.Field)),default:c.Default,auto:String(c.Extra).includes('auto_increment'),choices:String(c.Type).startsWith('enum(')?[...String(c.Type).matchAll(/'([^']*)'/g)].map(m=>m[1]):null}));}
 async lookups(test?:any){await this.ensure();const [departments,samples,containers]=await Promise.all([this.db('departments').select('id','department as name'),this.db('sampletype').select('id','name'),this.db('samplecontainer').select('id','name')]);const groups=test?await this.db('testdetailcategory').where({testid:positive(test),deleted:0}).select('categoryid as id','categoryname as name'):[];const parameters=test?await this.db('testcreationrules').where({testid:positive(test)}).select('id','name'):[];const conditionGroups=test?await this.db('testconditiondefinitions').where({testId:positive(test)}).select('id','conditionName as name'):[];return {departments,samples,containers,groups,parameters,conditionGroups,modules:Object.entries(catalogModules).map(([key,value])=>({key,recordKey:value.key,label:value.label,global:globals.has(key)}))};}
 async list(name:string, input:any){await this.ensure();const module=this.module(name);const page=positive(input.page??1),count=25;const query=this.db(module.table);if(!globals.has(name))query.where('testid',positive(input.testid));const search=String(input.search||'').trim();if(search.length>100)fail('Search must be 100 characters or less');const columns=await this.fields(name);const nameColumn=columns.find((c:any)=>['name','categoryname','title','department'].includes(c.name));if(search&&nameColumn)query.where(nameColumn.name,'like',`%${search.replace(/[\\%_]/g,'\\$&')}%`);if(name==='groups')query.where('deleted',0);const total=await query.clone().count({total:'*'}).first();return {rows:await query.clone().orderBy(module.key).limit(count).offset((page-1)*count),total:Number(total.total),page,pageSize:count,fields:columns.filter((c:any)=>!hidden.has(c.name.toLowerCase())&&c.name!==module.key)};}
 private async nextId(trx:any,table:string,column:string){const key=table+'.'+column;const current=await trx('master_catalog_sequences').where({key}).first();const maximum=await trx(table).max({value:column}).first();const value=Math.max(Number(current?.value||0),Number(maximum?.value||0))+1;await trx('master_catalog_sequences').insert({key,value}).onConflict('key').merge({value});return value;}
 async save(name:string, raw:any, actor:number, test?:any, record?:any){
  await this.ensure();const module=this.module(name);const testid=globals.has(name)?null:positive(test);const recordid=record?positive(record):null;
  if(!raw||Array.isArray(raw)||typeof raw!=='object')fail('Enter valid catalogue details');
  const fields=await this.fields(name);const allowed=new Map<string,any>(fields.filter((c:any)=>!hidden.has(c.name.toLowerCase())&&c.name!==module.key).map((c:any)=>[c.name,c]));const data:any={};
  for(const [key,value] of Object.entries(raw)){const field=allowed.get(key);if(!field)fail(`The field ${key} cannot be changed`);if(value!==null&&typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')fail(`Enter a valid value for ${key}`);if(field.choices&&value!=null&&!field.choices.includes(value))fail(`Choose a valid option for ${key}`);if(typeof value==='string'&&value.length>1000000)fail('Catalogue text is too long');if(value!=null&&value!==''&&/^(?:int|bigint|smallint|tinyint|decimal|float|double)/.test(field.type)&&!Number.isFinite(Number(value)))fail(`Enter a number for ${key}`);data[key]=value;}
  return this.db.transaction(async(trx:any)=>{
   await trx('master_catalog_sequences').where({key:'write_lock'}).forUpdate().first();
   if(testid&&!await trx('test_panels').where({id:testid}).first())fail('Master test not found',404);
   if(!recordid&&singletons.has(name)&&await trx(module.table).where({testid}).first())fail('This test already has this setup. Edit its existing record instead.',409);
   const scoped=()=>{const q=trx(module.table);if(testid)q.where({testid});return q};
   const before=recordid?await scoped().where(module.key,recordid).first():null;if(recordid&&!before)fail('Catalogue record not found',404);
   if(testid)data.testid=testid;
   for(const field of fields){if(!recordid&&!hidden.has(field.name.toLowerCase())&&field.name!==module.key&&!field.required&&field.default==null&&/^(?:varchar|text|longtext)/.test(field.type)&&!(field.name in data))data[field.name]='';if(requiredText.has(field.name)&&(!recordid||field.name in data)&&!String(data[field.name]??before?.[field.name]??'').trim())fail(`Enter ${field.name}`);if(['resultsettings','creationrule','input_parameters','conditions','deviceInterfaceMapping'].includes(field.name)&&data[field.name]){try{JSON.parse(String(data[field.name]))}catch{fail(`Enter valid structured settings for ${field.name}`)}}}

   if(name==='parameters'){if(!data.field&&!before?.field)data.field=data.name;const category=Number(data.categoryid||0);if(category&&!await trx('testdetailcategory').where({categoryid:category,testid,deleted:0}).first())fail('Choose a group belonging to this test');}
   if(name==='constraints'){const fieldColumn=fields.some((c:any)=>c.name==='fieldid')?'fieldid':'rule_id';const id=positive(data[fieldColumn]??before?.[fieldColumn]);if(!await trx('testcreationrules').where({id,testid}).first())fail('Choose a parameter belonging to this test');}
   if(name==='conditions'){const group=positive(data.conditionId??before?.conditionId);if(!await trx('testconditiondefinitions').where({id:group,testId:testid}).first())fail('Choose a condition group belonging to this test');}
   if(name==='panels'){for(const [key,table] of [['category','departments'],['sample','sampletype'],['sample_container','samplecontainer']])if(!await trx(table).where({id:positive(data[key]??before?.[key])}).first())fail(`Choose a valid ${key.replace('_',' ')}`);if(await trx('test_panels').whereRaw('LOWER(name) = LOWER(?)',[String(data.name??before?.name)]).modify((q:any)=>{if(recordid)q.whereNot('id',recordid)}).first())fail('A master test with this name already exists',409);}
   if(name==='calculations'){const merged={...before,...data};const inputs=JSON.parse(merged.input_parameters||'[]');if(!Array.isArray(inputs)||!inputs.length)fail('Choose formula input parameters');const ids=[positive(merged.output_field_id),...inputs.map((i:any)=>positive(i.fieldId))];const valid=await trx('testcreationrules').where({testid}).whereIn('id',ids).select('id');if(new Set(valid.map((r:any)=>Number(r.id))).size!==new Set(ids).size)fail('Formula parameters must belong to this test');try{validateFormula(merged.expression,inputs.map((i:any)=>i.token))}catch(error:any){fail(error.message||'Invalid calculation formula')}}
   for(const field of fields){if(['createdby','created_by','employeeid'].includes(field.name.toLowerCase())&&!recordid)data[field.name]=String(actor);if(['updatedby','updated_by'].includes(field.name.toLowerCase()))data[field.name]=actor;}
   let id=recordid;
   if(id){await scoped().where(module.key,id).update(data)}else{if(name==='panels')data.id=await this.nextId(trx,module.table,'id');const primary=fields.find((c:any)=>c.name===module.key);if(!primary?.auto&&name!=='panels')data[module.key]=await this.nextId(trx,module.table,module.key);const inserted=await trx(module.table).insert(data);id=name==='panels'?data.id:data[module.key]||Number(inserted[0]);}
   if(name==='panels'&&!recordid){await applyTestPanelsAfterInsert(trx,{testid:Number(id),price:Number(data.price||0),iscustom:Number(data.iscustom||0)});await trx('testdetails').where({testid:id}).update({updatedby:actor});if(!await trx('setupliteraturereview').where({testid:id}).first())await trx('setupliteraturereview').insert({testid:id,literature:''});}
   const after=await scoped().where(module.key,id).first();await trx('master_catalog_audit').insert({actor_id:actor,action:before?'updated':'created',module:name,testid:name==='panels'?id:testid,recordid:id,before_data:before?JSON.stringify(before):null,after_data:JSON.stringify(after)});return after;
  });
 }
 async remove(name:string, record:any, actor:number, test?:any){await this.ensure();const module=this.module(name),id=positive(record),testid=globals.has(name)?null:positive(test);return this.db.transaction(async(trx:any)=>{
  await trx('master_catalog_sequences').where({key:'write_lock'}).forUpdate().first();const query=trx(module.table).where(module.key,id);if(testid)query.where({testid});const before=await query.clone().first();if(!before)fail('Catalogue record not found',404);
  if(name==='panels'){for(const [key,child] of Object.entries(catalogModules).reverse()){if(globals.has(key)||!await trx.schema.hasTable(child.table))continue;await trx(child.table).where({testid:id}).delete();}}
  if(name==='groups'&&await trx('testcreationrules').where({testid,categoryid:id}).first())fail('Move or remove the parameters in this group before deleting it',409);
  if(name==='conditionGroups'&&await trx('testconditions').where({testId:testid,conditionId:id}).first())fail('Remove rules in this condition group before deleting it',409);
  if(name==='parameters'){if(await trx('calculated_parameter_formulas').where({testid}).where(function(this:any){this.where('output_field_id',id).orWhere('input_parameters','like',`%${id}%`)}).first())fail('Remove dependent calculation formulas before deleting this parameter',409);const columns=await trx('field_constraints').columnInfo();await trx('field_constraints').where({testid}).where(columns.fieldid?'fieldid':'rule_id',id).delete();}
  if(globals.has(name)&&name!=='panels'){const link=name==='departments'?'category':name==='samples'?'sample':'sample_container';if(await trx('test_panels').where(link,id).first())fail('This item is used by a master test and cannot be deleted',409);}
  await query.delete();await trx('master_catalog_audit').insert({actor_id:actor,action:'deleted',module:name,testid:name==='panels'?id:testid,recordid:id,before_data:JSON.stringify(before)});return {deleted:true};
 });}
}
