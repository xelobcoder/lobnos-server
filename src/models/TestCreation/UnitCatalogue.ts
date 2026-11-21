import {systemConfigConnection} from '../../database/connection';
import seed from './unitCatalogueSeed';
let ready:Promise<void>|undefined;
export function ensureUnitCatalogue(){return ready ||= (async()=>{
 const db=systemConfigConnection;
 if(!await db.schema.hasTable('lab_unit_catalogue'))await db.schema.createTable('lab_unit_catalogue',t=>{t.string('code',64).primary();t.string('symbol',64).notNullable();t.string('label',120).notNullable();t.text('aliases').notNullable();t.boolean('active').notNullable().defaultTo(true)});
 if(db.client.config.client==='mysql2')await db.raw('ALTER TABLE lab_unit_catalogue MODIFY code VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
 await db('lab_unit_catalogue').insert(seed.map(row=>({...row,aliases:JSON.stringify(row.aliases),active:true}))).onConflict('code').ignore();
})().catch(error=>{ready=undefined;throw error});}
export async function listUnits(){await ensureUnitCatalogue();return (await systemConfigConnection('lab_unit_catalogue').where({active:true}).orderBy('label')).map(row=>({...row,aliases:typeof row.aliases==='string'?JSON.parse(row.aliases):row.aliases}));}
export async function addUnit(data:any){await ensureUnitCatalogue();const code=String(data.code||'').trim(),symbol=String(data.symbol||'').trim(),label=String(data.label||'').trim();
 if(!code||code.length>64||!symbol||symbol.length>64||!label||label.length>120||/[\u0000-\u001f]/.test(code+symbol+label))throw Object.assign(new Error('Enter a unit code, symbol and name within the supported lengths'),{statusCode:400});
 if(await systemConfigConnection('lab_unit_catalogue').where({code}).first())throw Object.assign(new Error('This unit code already exists'),{statusCode:409});
 await systemConfigConnection('lab_unit_catalogue').insert({code,symbol,label,aliases:'[]',active:true});return {code,symbol,label,aliases:[]};
}
export async function unitForSave(rule:any){
 if(!Object.prototype.hasOwnProperty.call(rule,'unit_code'))return {};
 if(rule.unit_code===null||rule.unit_code==='')return {unit_code:null};
 const row=(await listUnits()).find(row=>row.code===rule.unit_code);
 if(!row||![row.symbol,...row.aliases].includes(rule.units))throw Object.assign(new Error('Choose a valid unit from the shared catalogue'),{statusCode:400});
 return {unit_code:row.code};
}
