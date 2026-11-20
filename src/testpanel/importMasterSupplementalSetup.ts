/** Copies configuration only; no tenant result, billing, or historical-report tables are touched. */
export async function importMasterSupplementalSetup(trx:any, setup:Record<string,any[]>, testid:number, fields:Map<number,number>, employeeid:number) {
    const conditionIds=new Map<number,number>();
    for(const table of ['testconditiondefinitions','testconditions','field_constraints','customtestcreation','proceduremanual','test_report_settings','calculated_parameter_formulas']) {
        const rows=setup[table]||[];if(!rows.length)continue;
        if(!await trx.schema.hasTable(table))throw Error(`Destination does not support ${table}; update the facility before importing this setup`);
        const columns=await trx(table).columnInfo();
        for(const source of rows){
            const row:any={...source};delete row.id;
            for(const key of Object.keys(row))if(key.toLowerCase()==='testid')row[key]=testid;
            const mapped=(value:any)=>{const id=fields.get(Number(value));if(!id)throw Error('Master configuration references a missing parameter');return id};
            if(table==='field_constraints'){const sourceField=source.rule_id??source.fieldid;delete row.rule_id;delete row.fieldid;row[columns.rule_id?'rule_id':'fieldid']=mapped(sourceField)}
            if(table==='testconditions'){row.conditionId=conditionIds.get(Number(source.conditionId));if(!row.conditionId)throw Error('Master condition group is missing');if(fields.has(Number(row.parameter)))row.parameter=mapped(row.parameter)}
            if(table==='calculated_parameter_formulas'){
                row.output_field_id=mapped(source.output_field_id);
                const inputs=typeof source.input_parameters==='string'?JSON.parse(source.input_parameters):source.input_parameters;
                row.input_parameters=JSON.stringify(inputs.map((input:any)=>({...input,fieldId:mapped(input.fieldId)})));
                if(row.conditions&&typeof row.conditions!=='string')row.conditions=JSON.stringify(row.conditions);
            }
            if(table==='test_report_settings'&&typeof row.resultsettings!=='string')row.resultsettings=JSON.stringify(row.resultsettings);
            if(table==='customtestcreation'&&row.creationrule){
                const template=typeof row.creationrule==='string'?JSON.parse(row.creationrule):row.creationrule;
                const remap=(value:any):any=>Array.isArray(value)?value.map(remap):value&&typeof value==='object'
                    ? Object.fromEntries(Object.entries(value).map(([key,child])=>[key,['fieldid','fieldId','rule_id'].includes(key)?mapped(child):key.toLowerCase()==='testid'?testid:remap(child)])) : value;
                row.creationrule=JSON.stringify(remap(template));
            }
            for(const key of ['createdby','created_by','createdBy','updatedby','updated_by','updatedBy'])if(key in row)row[key]=employeeid;
            const supported=Object.fromEntries(Object.entries(row).filter(([key])=>columns[key]));
            let inserted:any;
            if(['customtestcreation','proceduremanual','test_report_settings'].includes(table)){
                const existing=await trx(table).where({testid}).first();
                if(existing){await trx(table).where({testid}).update(supported);inserted=[existing.id]}
                else inserted=await trx(table).insert(supported);
            }else inserted=await trx(table).insert(supported);
            if(table==='testconditiondefinitions')conditionIds.set(Number(source.id),Number(inserted[0]));
        }
    }
}
