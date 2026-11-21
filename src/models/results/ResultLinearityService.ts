import {decrypt_value} from '../../utils/encryptionModels';
import {parseNumericResult} from './ResultDeltaService';
import {linearityViolation} from '../TestCreation/reportValidation';
/** Called in validation and release transactions, including initial-entry validation bypass. */
export async function assertResultLinearity(trx:any,ascensionid:number,testid:number){
 const rules=await trx('testcreationrules').where({testid,linearity_enabled:true});
 if(!rules.length)return;
 const rows=await trx('test_results').where({ascensionid,testid});
 const failures:string[]=[];
 for(const rule of rules){const row=rows.find((r:any)=>Number(r.fieldid)===Number(rule.id));if(!row)continue;
  let value=row.value;try{value=decrypt_value(String(value));}catch{}
  if(linearityViolation(rule,parseNumericResult(value)))failures.push(`${rule.name}: ${value} (linearity ${rule.linearity_lower} to ${rule.linearity_upper} ${rule.units||''})`);
 }
 if(failures.length)throw Object.assign(new Error(`Linearity Check failed. Review the measurement or dilution before validation and release. ${failures.join('; ')}`),{statusCode:409,code:'LINEARITY_CHECK_BLOCKED'});
}
