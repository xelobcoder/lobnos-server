const pending = new WeakMap<object,Promise<void>>();
/** Additive compatibility upgrade for both tenant and master catalogue connections. */
export function ensureParameterRequiredColumn(db:any):Promise<void> {
 let task=pending.get(db);
 if(!task){task=(async()=>{
  if(!await db.schema.hasColumn('testcreationrules','isRequired')) {
   try {await db.schema.alterTable('testcreationrules',(table:any)=>table.boolean('isRequired').notNullable().defaultTo(false));}
   catch(error:any){if(error.code!=='ER_DUP_FIELDNAME')throw error;}
  }
 })();pending.set(db,task);task.catch(()=>pending.delete(db));}
 return task;
}
