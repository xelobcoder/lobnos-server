import { Knex } from 'knex';
import { ensurePharmacyProcurementSchema } from '../../../models/pharmacy/PharmacyProcurementSchema';

export const up = (db: Knex) => ensurePharmacyProcurementSchema(db);
