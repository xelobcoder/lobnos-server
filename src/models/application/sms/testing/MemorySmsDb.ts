/** Transactional database double for campaign state transitions; never connects to MySQL. */
export function memorySmsDb(initial: Record<string, any[]> = {}) {
    let data = structuredClone(initial), tail = Promise.resolve();
    const tableName = (name: string) => name.split(/\s+as\s+/i)[0];
    const value = (row: any, column: string) => row[column] !== undefined ? row[column] : row[column.split('.').pop()!];
    const bare = (row: any) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.includes('.')));
    const db: any = (source: string) => {
        const table = tableName(source), alias = source.split(/\s+as\s+/i)[1];
        const conditions: Array<{ test: (row: any) => boolean; or: boolean }> = [];
        const joins: any[] = [], orders: any[] = []; let limit = Infinity, offset = 0, columns: string[] = [];
        const test = (row: any) => conditions.reduce((result, condition, index) => index === 0 ? condition.test(row) : condition.or ? result || condition.test(row) : result && condition.test(row), true);
        function condition(args: any[], or = false) {
            const [field, op, expected] = args;
            if (typeof field === 'function') { const nested = db(source); field.call(nested); conditions.push({ test: nested.test, or }); }
            else if (typeof field === 'object') conditions.push({ test: row => Object.entries(field).every(([key, expected]) => value(row,key) === expected), or });
            else conditions.push({ test: row => {
                const current = value(row,field), target = args.length === 2 ? op : expected, operation = args.length === 2 ? '=' : op;
                if (operation === '=') return current === target;
                if (operation === '<') return current != null && current < target;
                if (operation === '<=') return current != null && current <= target;
                if (operation === '>') return current != null && current > target;
                if (operation === '>=') return current != null && current >= target;
                throw new Error('Unsupported comparison ' + operation);
            }, or });
            return query;
        }
        function rows() {
            let result = (data[table] || []).map(row => ({ ...row, ...Object.fromEntries(alias ? Object.entries(row).map(([key,val]) => [alias+'.'+key,val]) : []) }));
            for (const [source,left,right,isLeft] of joins) {
                const name=tableName(source),alias=source.split(/\s+as\s+/i)[1];
                result = result.flatMap(row => {
                    const matches = (data[name] || []).map(target => ({...row,...target,...Object.fromEntries(Object.entries(target).map(([key,val])=>[alias+'.'+key,val]))}))
                        .filter(target => value(target,left) === value(target,right));
                    return matches.length ? matches : isLeft ? [row] : [];
                });
            }
            result = result.filter(test);
            for (const [column,direction] of [...orders].reverse()) result.sort((a,b) => {
                const x=value(a,column),y=value(b,column);return (x===y?0:x==null?-1:y==null?1:x<y?-1:1)*(direction==='desc'?-1:1);
            });
            return result.slice(offset,offset+limit);
        }
        const query: any = {
            test, where(...args: any[]) { return condition(args); }, andWhere(...args: any[]) { return condition(args); },
            orWhere(...args: any[]) { return condition(args,true); },
            whereIn(column: string, values: any[]) { conditions.push({test:row=>values.includes(value(row,column)),or:false});return this; },
            whereNotIn(column: string, values: any[]) { conditions.push({test:row=>!values.includes(value(row,column)),or:false});return this; },
            whereNull(column: string) { conditions.push({test:row=>value(row,column)==null,or:false});return this; },
            whereNotNull(column: string) { conditions.push({test:row=>value(row,column)!=null,or:false});return this; },
            orderBy(column: string,direction='asc') {orders.push([column,direction]);return this;},
            forUpdate(){return this;},skipLocked(){return this;},limit(n:number){limit=n;return this;},offset(n:number){offset=n;return this;},
            select(...selected:string[]){columns=selected;return this;},
            join(source:string,left:string,right:string){joins.push([source,left,right,false]);return this;},
            leftJoin(source:string,left:string,right:string){joins.push([source,left,right,true]);return this;},
            async first(...selected:string[]) {const row=rows()[0];return row?structuredClone(bare(row)):undefined;},
            async update(patch:any) {let changed=0;for(const row of data[table]||[])if(test({...row,...Object.fromEntries(alias?Object.entries(row).map(([key,val])=>[alias+'.'+key,val]):[])})){Object.assign(row,patch);changed++;}return changed;},
            async del(){const before=(data[table]||[]).length;data[table]=(data[table]||[]).filter(row=>!test(row));return before-data[table].length;},
            insert(input:any){let ignore=false;const operation:any={onConflict(){return this;},ignore(){ignore=true;return this;},then(resolve:any,reject:any){try{
                const inserted:number[]=[];data[table]||=[];
                for(const item of Array.isArray(input)?input:[input]){
                    const idColumn=table==='primesmsjobs'?'jobid':table==='primesmsjobrecipients'?'recid':'id';
                    const row={...item};if(table!=='sms_campaign_dispatch'&&row[idColumn]==null)row[idColumn]=Math.max(0,...data[table].map(row=>Number(row[idColumn])||0))+1;
                    const duplicate=table==='sms_campaign_dispatch'&&data[table].some(existing=>existing.jobid===row.jobid||(row.request_key&&existing.request_key===row.request_key));
                    if(duplicate){if(ignore)continue;throw Object.assign(new Error('Duplicate'),{code:'ER_DUP_ENTRY'});}
                    data[table].push(row);inserted.push(row[idColumn]);
                }return Promise.resolve(inserted).then(resolve,reject);
            }catch(error){return Promise.reject(error).then(resolve,reject);}}};return operation;},
            then(resolve:any,reject:any){return Promise.resolve(rows().map(row=>structuredClone(bare(row)))).then(resolve,reject);},
        };
        return query;
    };
    db.transaction=async(callback:any)=>{
        const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;
        const snapshot=structuredClone(data);try{return await callback(db);}catch(error){data=snapshot;throw error;}finally{release();}
    };
    db.snapshot=()=>structuredClone(data);
    return db;
}
