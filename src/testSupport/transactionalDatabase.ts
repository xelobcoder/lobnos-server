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
               let sum: { field: string; alias: string } | undefined;
               const equal = (a: any, b: any) => a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
               const query: any = {
                    where(key: string | Record<string, any>, value?: any) {
                         filters.push(typeof key === 'object' ? row => Object.entries(key).every(([k, v]) => equal(row[k], v)) : row => equal(row[key], value));
                         return query;
                    },
                    whereIn(key: string, values: any[]) { filters.push(row => values.includes(row[key])); return query; },
                    whereNotIn(key: string, values: any[]) { filters.push(row => !values.includes(row[key])); return query; },
                    orderBy() { return query; },
                    forUpdate() { locking = true; events.push('lock:' + table); return query; },
                    first() { first = true; return query; },
                    sum(expression: string) { const [field, alias] = expression.split(' as '); sum = { field, alias }; return query; },
                    async insert(data: any) {
                         if (!local) throw new Error('Write without a preceding lock');
                         events.push('insert:' + table);
                         const row = { id: nextId++, ...data };
                         (local[table] ||= []).push(row);
                         return [row.id];
                    },
                    async update(data: any) {
                         if (!local) throw new Error('Write without a preceding lock');
                         events.push('update:' + table);
                         const rows = (local[table] || []).filter(row => filters.every(filter => filter(row)));
                         rows.forEach(row => Object.assign(row, data));
                         return rows.length;
                    },
                    async then(resolve: any, reject: any) {
                         try {
                              if (locking) await lock();
                              const rows = (local?.[table] || tables[table] || []).filter(row => filters.every(filter => filter(row)));
                              if (sum) return resolve({ [sum.alias]: rows.reduce((total, row) => total + Number(row[sum!.field] || 0), 0) });
                              return resolve(structuredClone(first ? rows[0] : rows));
                         } catch (error) { return reject(error); }
                    },
               };
               return query;
          };
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
