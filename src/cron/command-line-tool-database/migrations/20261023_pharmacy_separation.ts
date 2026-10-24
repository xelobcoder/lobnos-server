import { Knex } from 'knex';
import { ensurePharmacySeparationSchema } from '../../../models/pharmacy/PharmacySeparationSchema';
export const up = (db: Knex) => ensurePharmacySeparationSchema(db);
export async function down(_db: Knex): Promise<void> { /* Never discard financial or stock history. */ }
