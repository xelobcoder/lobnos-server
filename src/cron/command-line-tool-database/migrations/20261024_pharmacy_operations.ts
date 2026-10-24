import { Knex } from 'knex';
import { ensurePharmacyOperationsSchema } from '../../../models/pharmacy/PharmacyOperationsSchema';
export const up = (db: Knex) => ensurePharmacyOperationsSchema(db);
export async function down(_db: Knex): Promise<void> { /* Keep stock conversion and financial-day audit history. */ }
