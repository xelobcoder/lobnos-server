import { Knex } from 'knex';
import { ensureBillingIntegritySchema } from '../../../models/billing/BillingIntegritySchema';
export const up = (db: Knex) => ensureBillingIntegritySchema(db);
export async function down(_db: Knex): Promise<void> { /* Preserve financial request and correction history. */ }
