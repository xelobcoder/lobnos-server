const pending = new WeakMap<object,Promise<void>>();
/** Additive definition columns for client and master. Existing values are never inferred or backfilled. */
export function ensureParameterDefinitionSchema(db:any):Promise<void> {
 let task=pending.get(db);
 if(!task){task=(async()=>{
  for(const column of ['result_type','reference_mode','unit_code'])if(!await db.schema.hasColumn('testcreationrules',column)) {
   try {await db.schema.alterTable('testcreationrules',(table:any)=>table.string(column,64).nullable());}
   catch(error:any){if(error.code!=='ER_DUP_FIELDNAME')throw error;}
  }
  if(!await db.schema.hasColumn('testcreationrules','isRequired')) {
   try {await db.schema.alterTable('testcreationrules',(table:any)=>table.boolean('isRequired').notNullable().defaultTo(false));}
   catch(error:any){if(error.code!=='ER_DUP_FIELDNAME')throw error;}
  }
 })();pending.set(db,task);task.catch(()=>pending.delete(db));}
 return task;
}

// Compatibility for the earlier required-field migration and deployment scripts.
export const ensureParameterRequiredColumn=ensureParameterDefinitionSchema;
