import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { up as migratePatientPortal } from '../../cron/command-line-tool-database/migrations/20261019_patient_portal';

const readiness = new WeakMap<Knex, Promise<void>>();

/** Creates the facility's portal tables once per connection; retried if a previous attempt failed. */
export async function bootstrapPatientPortal(tenantId: number): Promise<Knex> {
     const connection = await KnexConnection(tenantId);
     let ready = readiness.get(connection);
     if (!ready) {
          ready = migratePatientPortal(connection).catch(error => {
               readiness.delete(connection);
               throw error;
          });
          readiness.set(connection, ready);
     }
     await ready;
     return connection;
}
