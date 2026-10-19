import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { up } from '../../../cron/command-line-tool-database/migrations/20261022_organization_credit_invoices';

const readiness = new WeakMap<Knex, Promise<void>>();

/** Ensures the invoice tables exist on this facility database (once per connection). */
export async function bootstrapOrganizationInvoices(tenantId: number): Promise<Knex> {
     const db = await KnexConnection(tenantId);
     let ready = readiness.get(db);
     if (!ready) {
          ready = up(db).catch(error => { readiness.delete(db); throw error; });
          readiness.set(db, ready);
     }
     await ready;
     return db;
}
