import { Knex } from 'knex';
import { ensurePharmacyAccountingSchema } from '../../../models/pharmacy/accounting/PharmacyAccountingSchema';

export async function up(db: Knex): Promise<void> {
     await ensurePharmacyAccountingSchema(db);
}

export async function down(_db: Knex): Promise<void> {
     throw new Error('Pharmacy account history cannot be deleted by rollback; use controlled financial corrections');
}
