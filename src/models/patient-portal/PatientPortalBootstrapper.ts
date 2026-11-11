import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { up as migratePatientPortal } from '../../cron/command-line-tool-database/migrations/20261019_patient_portal';
import { up as migratePatientEngagement } from '../../cron/command-line-tool-database/migrations/20261021_patient_portal_engagement';
import { bootstrapHomeCollectionTables } from '../operations/sample/HomeCollection/BootstrapHomeCollection';
import { ensurePortalLoginAttemptSecurity } from '../auth/LoginAttemptSecurity';

const readiness = new WeakMap<Knex, Promise<void>>();

/** Creates the facility's portal tables once per connection; retried if a previous attempt failed. */
export async function bootstrapPatientPortal(tenantId: number): Promise<Knex> {
     const connection = await KnexConnection(tenantId);
     let ready = readiness.get(connection);
     if (!ready) {
          ready = migratePatientPortal(connection)
               .then(() => ensurePortalLoginAttemptSecurity(connection))
               .then(() => bootstrapHomeCollectionTables(tenantId))
               .then(() => migratePatientEngagement(connection))
               .catch(error => {
                    readiness.delete(connection);
                    throw error;
               });
          readiness.set(connection, ready);
     }
     await ready;
     return connection;
}
