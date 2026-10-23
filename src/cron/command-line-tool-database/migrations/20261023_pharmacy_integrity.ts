import { Knex } from 'knex';
import { ensurePharmacyIntegritySchema } from '../../../models/pharmacy/PharmacyIntegritySchema';
export const up = (db: Knex) => ensurePharmacyIntegritySchema(db);
export async function down(_db: Knex): Promise<void> { /* Preserve dispensing and payment audit history. */ }
