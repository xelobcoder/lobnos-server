/** Execute real Knex queries against an isolated SQLite database. MySQL locking is tested separately. */
import knex from 'knex';
const ClientSQLite = require('knex/lib/dialects/sqlite3');
export function accountingSqlDatabase() {
 const { DatabaseSync } = require('node:sqlite');
 const native = new DatabaseSync(':memory:');
 native.function('DATE_FORMAT', (value: any, format: any) => { if (format !== '%Y-%m') throw new Error('Unsupported test format'); return String(value).slice(0,7); });
 native.function('JSON_UNQUOTE', (value: any) => value);
 const bindings = (values: any[]) => (values || []).map(value => value instanceof Date ? value.toISOString() : typeof value === 'boolean' ? Number(value) : value === undefined ? null : value);
 const handle = {
   all(sql: string, values: any[], callback: any) { try { const rows = native.prepare(sql).all(...bindings(values)); callback.call({}, null, rows); } catch(error) { callback(error); } },
   run(sql: string, values: any[], callback: any) { try { const result = native.prepare(sql).run(...bindings(values)); callback.call({ lastID: Number(result.lastInsertRowid), changes: Number(result.changes) }, null); } catch(error: any) { if (String(error.message).includes('UNIQUE constraint')) error.code = 'ER_DUP_ENTRY'; callback(error); } },
   close(callback: any) { native.close(); callback(); },
 };
 class Client extends ClientSQLite { _driver() { return {}; } async acquireRawConnection() { return handle; } }
 const db = knex({ client: Client as any, connection: { filename: ':memory:' }, useNullAsDefault: true, pool: { min: 1, max: 1 } });
 return { db, native };
}
