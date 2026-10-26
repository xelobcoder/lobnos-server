/** Small transactional adapter for workflow tests; it does not substitute for MySQL integration tests. */
export function transactionalDatabase(initial: Record<string, any[]>) {
     let tables = structuredClone(initial);
     let tail = Promise.resolve();
     let nextId = 1;
     const events: string[] = [];
     const db: any = () => { throw new Error('Workflow accessed the database outside its transaction'); };
     db.transaction = async (callback: (trx: any) => Promise<any>) => {
          let release: (() => void) | undefined;
          let local: Record<string, any[]> | undefined;
          const lock = async () => {
               if (local) return;
               const previous = tail;
               tail = new Promise<void>(resolve => { release = resolve; });
               await previous;
               local = structuredClone(tables);
          };
          const trx: any = (table: string) => {
               const filters: Array<(row: any) => boolean> = [];
               let locking = false;
               let first = false;
               const sums: Array<{ field: string; alias: string }> = [];
               const minima: Array<{ field: string; alias: string }> = [];
               let groups: string[] = [], movementBalance = false;
               const equal = (a: any, b: any) => a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
               const column = (key: string) => key.split('.').pop()!;
               const query: any = {
                    _filters: filters,
                    clone() { const copy = trx(table); copy._filters.push(...filters); return copy; },
                    select(...fields: any[]) { if (fields.some(f => typeof f?.sql === 'string' && /SUM\(new_stock - previous_stock\)/i.test(f.sql))) movementBalance = true; return query; }, join() { return query; }, leftJoin() { return query; }, groupBy(...fields: string[]) { groups = fields; return query; },
                    async columnInfo() { return { type: 'int' }; },
                    orderByRaw() { return query; }, havingRaw() { return query; },
                    whereRaw(sql?: string, bindings?: any[]) {
                         if (sql?.includes('COALESCE(financial_date, DATE(opened_at))')) {
                              const expected = String(bindings?.[0]);
                              filters.push(row => { const value = row.financial_date || row.opened_at; const actual = value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10); return sql.includes('<=') ? actual <= expected : actual < expected; });
                         }
                         return query;
                    },
                    whereNotNull(key: string) { filters.push(row => row[column(key)] != null); return query; },
                    whereNull(key: string) { filters.push(row => row[column(key)] == null); return query; },
                    where(key: string | Record<string, any> | Function, value?: any, operand?: any) {
                         if (typeof key === 'function') {
                              let condition: ((row: any) => boolean) | undefined;
                              const nested: any = {
                                   where(field: string, expected: any) { const previous = condition; condition = row => (!previous || previous(row)) && equal(row[column(field)], expected); return nested; },
                                   whereNull(field: string) { const previous = condition; condition = row => (!previous || previous(row)) && row[column(field)] == null; return nested; },
                                   orWhere(field: string, expected: any, operand?: any) { const previous = condition; condition = row => !!previous?.(row) || (operand === undefined ? equal(row[column(field)], expected) : expected === '>=' ? row[column(field)] >= operand : equal(row[column(field)], operand)); return nested; },
                                   orWhereNull(field: string) { const previous = condition; condition = row => !!previous?.(row) || row[column(field)] == null; return nested; },
                              };
                              key(nested); filters.push(row => !condition || condition(row));
                         } else filters.push(typeof key === 'object' ? row => Object.entries(key).every(([k, v]) => equal(row[column(k)], v)) : row => operand === undefined ? equal(row[column(key)], value) : value === '>=' ? row[column(key)] >= operand : value === '<=' ? row[column(key)] <= operand : value === '<' ? row[column(key)] < operand : value === '>' ? row[column(key)] > operand : equal(row[column(key)], operand));
                         return query;
                    },
                    whereIn(key: string, values: any[]) { filters.push(row => values.includes(row[column(key)])); return query; },
                    andWhere(...args: any[]) { return query.where(...args); },
                    whereNotIn(key: string, values: any[]) { filters.push(row => !values.includes(row[key])); return query; },
                    orderBy() { return query; },
                    forUpdate() { locking = true; events.push('lock:' + table); return query; },
                    first() { first = true; return query; },
                    sum(expression: string) { const [field, alias] = expression.split(' as '); sums.push({ field: column(field), alias }); return query; },
                    min(expression: string) { const [field, alias] = expression.split(' as '); minima.push({ field: column(field), alias }); return query; },
                    insert(data: any) {
                         let conflictKeys: string[] = [], ignore = false;
                         const insertion: any = {
                              onConflict(keys: string[]) { conflictKeys = keys; return insertion; },
                              ignore() { ignore = true; return insertion; },
                              async then(resolve: any, reject: any) {
                                   try {
                                        await lock();
                                        events.push('insert:' + table);
                                        const rows = (Array.isArray(data) ? data : [data]).filter(value => !ignore || !(local![table] || []).some(row => conflictKeys.every(key => equal(row[key], value[key])))).map(value => table==='roles'?{id:nextId++,employeeid:Math.max(0,...(local![table]||[]).map(row=>Number(row.employeeid)||0))+1,...value}:({ id: nextId++, ...value }));
                                        (local![table] ||= []).push(...rows);
                                        resolve(rows.map(row => table==='roles'?row.employeeid:row.id));
                                   } catch (error) { reject(error); }
                              },
                         };
                         return insertion;
                    },
                    async update(data: any) {
                         if (!local) throw new Error('Write without a preceding lock');
                         events.push('update:' + table);
                         const rows = (local[table] || []).filter(row => filters.every(filter => filter(row)));
                         rows.forEach(row => Object.assign(row, data));
                         return rows.length;
                    },
                    async del() {
                         if (!local) throw new Error('Delete without a preceding lock');
                         const rows=local[table]||[],remaining=rows.filter(row=>!filters.every(filter=>filter(row)));
                         local[table]=remaining;
                         events.push('delete:'+table);
                         return rows.length-remaining.length;
                    },
                    async then(resolve: any, reject: any) {
                         try {
                              if (locking) await lock();
                              const baseTable = table.split(' as ')[0];
                              const rows = (local?.[table] || local?.[baseTable] || tables[table] || tables[baseTable] || []).filter(row => filters.every(filter => filter(row)));
                              if (sums.length || minima.length || movementBalance) {
                                   const aggregate = (part: any[]) => ({
                                        ...Object.fromEntries(groups.map(key => [column(key), part[0]?.[column(key)]])),
                                        ...Object.fromEntries(sums.map(sum => [sum.alias, part.reduce((total, row) => total + Number(row[sum.field] || 0), 0)])),
                                        ...Object.fromEntries(minima.map(min => [min.alias, part.map(row => row[min.field]).filter(v => v != null).sort()[0] || null])),
                                        ...(movementBalance ? { available: part.reduce((total, row) => total + Number(row.new_stock) - Number(row.previous_stock), 0) } : {}),
                                   });
                                   if (!groups.length) return resolve(aggregate(rows));
                                   const partitions = new Map<string, any[]>();
                                   for (const row of rows) { const key = JSON.stringify(groups.map(g => row[column(g)])); partitions.set(key, [...(partitions.get(key) || []), row]); }
                                   const results = [...partitions.values()].map(aggregate); return resolve(first ? results[0] : results);
                              }
                              return resolve(structuredClone(first ? rows[0] : rows));
                         } catch (error) { return reject(error); }
                    },
               };
               return query;
          };
          trx.raw = (sql: string) => ({ sql });
          try {
               const result = await callback(trx);
               if (local) tables = local;
               events.push('commit');
               return result;
          } catch (error) {
               events.push('rollback');
               throw error;
          } finally { release?.(); }
     };
     return { db, events, rows: (table: string) => structuredClone(tables[table] || []) };
}
