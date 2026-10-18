import { Knex } from 'knex';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { up } from '../../cron/command-line-tool-database/migrations/20261020_patient_billing_requests';

const readiness = new WeakMap<Knex, Promise<void>>();

export async function bootstrapPatientBillingRequests(tenantId: number): Promise<Knex> {
     const db = await bootstrapPatientPortal(tenantId);
     let ready = readiness.get(db);
     if (!ready) {
          ready = up(db).catch(error => { readiness.delete(db); throw error; });
          readiness.set(db, ready);
     }
     await ready;
     return db;
}
