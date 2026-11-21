const specs={departments:{table:'departments',key:'department',fields:['department']},samples:{table:'sampletype',key:'name',fields:['name']},containers:{table:'samplecontainer',key:'name',fields:['name','description','volume_capacity','material','color','is_reusable']}} as const;
const normalize=(v:any)=>String(v??'').trim().replace(/\s+/g,' ').toLowerCase();
const fail=(message:string,statusCode=400):never=>{throw Object.assign(new Error(message),{statusCode});};
function spec(kind:string){return (Object.prototype.hasOwnProperty.call(specs,kind)?specs[kind as keyof typeof specs]:undefined)??fail('Choose departments, samples or containers');}
export class MasterLookupImport {
 constructor(private source:any,private destination:any){}
 async preview(kind:string){const s=spec(kind);const [source,local]=await Promise.all([this.source(s.table).select('id',...s.fields).orderBy(s.key),this.destination(s.table).select('*')]);
 return source.map((row:any)=>{const matches=local.filter((l:any)=>normalize(l[s.key])===normalize(row[s.key]));const conflict=matches.length>1||matches.some((l:any)=>kind==='containers'&&['volume_capacity','material','color','is_reusable'].some(key=>['volume_capacity','is_reusable'].includes(key)?Number(l[key]??0)!==Number(row[key]??0):normalize(l[key])!==normalize(row[key])));
 return {id:Number(row.id),name:row[s.key],details:kind==='containers'?`${row.volume_capacity??0} mL · ${row.material??''} · ${row.color??''}`:'',status:matches.length?(conflict?'conflict':'existing'):'new',values:Object.fromEntries(s.fields.map(key=>[key,row[key]]))};});}
 async apply(kind:string,ids:any,employeeid:number){const s=spec(kind);
 if(!Array.isArray(ids)||!ids.length||ids.length>1000||ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==ids.length)fail('Select valid master items to import');
 // Serialize imports per lookup kind, including facilities whose lookup tables are empty.
 if(!await this.destination.schema.hasTable('lab_master_lookup_locks')){try{await this.destination.schema.createTable('lab_master_lookup_locks',(t:any)=>t.string('kind',32).primary());}catch(e:any){if(e.code!=='ER_TABLE_EXISTS_ERROR')throw e;}}
 await this.destination('lab_master_lookup_locks').insert({kind}).onConflict('kind').ignore();
 return this.destination.transaction(async(trx:any)=>{
  await trx('lab_master_lookup_locks').where({kind}).forUpdate().first();
  const rows=await this.source(s.table).whereIn('id',ids).select('id',...s.fields);if(rows.length!==ids.length)fail('A master item no longer exists. Refresh the preview.',409);
  let imported=0,skipped=0;const columns=await trx(s.table).columnInfo();const locals=await trx(s.table).select('*');
  for(const row of rows){const local=locals.find((item:any)=>normalize(item[s.key])===normalize(row[s.key]));if(local){skipped++;continue;}
   const values:any=Object.fromEntries(s.fields.filter(key=>columns[key]&&row[key]!==undefined).map(key=>[key,row[key]]));values[s.key]=String(row[s.key]).trim();
   if(kind==='departments'){if(columns.departmentManager)values.departmentManager='System Import';if(columns.employeeid)values.employeeid=employeeid;}
   await trx(s.table).insert(values);locals.push(values);imported++;
  }
  return {imported,skipped};
 });}
}
