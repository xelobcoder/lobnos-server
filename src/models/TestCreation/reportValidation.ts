/** Analytical measurement limits are distinct from healthy-patient reference intervals. */
const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:400});};
const enabled=(value:any)=>value===true||value===1||value==='1';
function number(value:any,label:string,required=false):number|null {
 if(value===null||value===undefined||value==='')return required?fail(`${label} is required`):null;
 const n=Number(value);if(!Number.isFinite(n))return fail(`${label} must be a finite number`);return n;
}
export function analyticTatForSave(value:any){
 const parts=['days','hours','minutes'].map(key=>{const n=number(value?.[key],key,true)!;if(!Number.isSafeInteger(n)||n<0)return fail('Analytic TAT must use non-negative whole numbers');return n;});
 const [days,hours,minutes]=parts;const total=days*1440+hours*60+minutes;
 if(total>2147483647)return fail('Analytic TAT is too large');
 return {tat:total,minutes:total};
}
export function cleanValidationRule(row:any){
 const fieldid=Number(row.fieldid);if(!Number.isSafeInteger(fieldid)||fieldid<1)return fail('A valid parameter is required');
 const linearity_enabled=enabled(row.linearity_enabled),delta_enabled=enabled(row.delta_enabled);
 const linearity_lower=number(row.linearity_lower,'Linearity lower limit',linearity_enabled);
 const linearity_upper=number(row.linearity_upper,'Linearity upper limit',linearity_enabled);
 if(linearity_lower!==null&&linearity_upper!==null&&linearity_lower>linearity_upper)return fail('Linearity lower limit must not exceed upper limit');
 const max_absolute=number(row.max_absolute,'Absolute change limit');const max_percent=number(row.max_percent,'Percentage change limit');
 if((max_absolute!==null&&max_absolute<0)||(max_percent!==null&&max_percent<0))return fail('Delta limits cannot be negative');
 if(delta_enabled&&max_absolute===null&&max_percent===null)return fail('Delta Check needs an absolute or percentage change limit');
 const window_hours=number(row.window_hours??720,'Delta lookback hours',true)!;
 if(!Number.isInteger(window_hours)||window_hours<1||window_hours>8760)return fail('Delta lookback must be 1 to 8760 hours');
 const action=row.action??'warn';if(!['warn','block'].includes(action))return fail('Delta action must be warn or block');
 return {fieldid,linearity_enabled,linearity_lower,linearity_upper,delta_enabled,max_absolute,max_percent,window_hours,action};
}
export function linearityViolation(rule:any,value:unknown):boolean {
 if(!enabled(rule.linearity_enabled)||value===null||value===undefined||String(value).trim()==='')return false;
 const n=Number(value);if(!Number.isFinite(n))return false;
 return (rule.linearity_lower!==null&&rule.linearity_lower!==undefined&&n<Number(rule.linearity_lower))||(rule.linearity_upper!==null&&rule.linearity_upper!==undefined&&n>Number(rule.linearity_upper));
}

export function cleanReportValidationRules(value:any){
 if(!Array.isArray(value))throw Object.assign(new Error('Rules must be an array'),{statusCode:400});
 const rules=value.map(cleanValidationRule);
 if(new Set(rules.map(r=>r.fieldid)).size!==rules.length)throw Object.assign(new Error('Duplicate parameters'),{statusCode:400});
 return rules;
}
export async function saveReportValidationRules(trx:any,id:number,rules:ReturnType<typeof cleanReportValidationRules>,employeeid:number|null){
  const fields=await trx('testcreationrules').where({testid:id}).select('id');
  for(const rule of rules){if(!fields.some(f=>Number(f.id)===rule.fieldid))throw Object.assign(new Error('Parameter belongs to another test'),{statusCode:400});
   await trx('testcreationrules').where({id:rule.fieldid,testid:id}).update({linearity_enabled:rule.linearity_enabled,linearity_lower:rule.linearity_lower,linearity_upper:rule.linearity_upper});
   const scope={testid:id,fieldid:rule.fieldid};const existing=await trx('pls_delta_rules').where(scope).orderBy('id','desc');
   if(existing.length)await trx('pls_delta_rules').where(scope).update({active:false,updated_at:new Date()});
   // Do not introduce disabled specific rules that could mask existing inherited rules.
   if(rule.delta_enabled){const values={...scope,window_hours:rule.window_hours,max_absolute:rule.max_absolute,max_percent:rule.max_percent,action:rule.action,active:true,updated_at:new Date()};
    if(existing.length)await trx('pls_delta_rules').where({id:existing[0].id}).update(values);else await trx('pls_delta_rules').insert({...values,created_by:employeeid,created_at:new Date()});}
  }
}
