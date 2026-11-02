import { Knex } from 'knex';
import { ensurePharmacyAccountingSchema } from '../../../models/pharmacy/accounting/PharmacyAccountingSchema';
import { ensurePharmacyAttributionColumns, ensurePharmacySourceModule } from '../../../accountingModule/init/pharmacyAttributionSchema';
import { ensurePharmacyTaxSchema } from '../../../models/pharmacy/PharmacyTax';

export async function up(db: Knex): Promise<void> {
     await ensurePharmacyAccountingSchema(db);
     await ensurePharmacyTaxSchema(db);
     await ensurePharmacyAttributionColumns(db);
     await ensurePharmacySourceModule(db);
}

export async function down(_db: Knex): Promise<void> {
     throw new Error('Pharmacy accounting history cannot be deleted by rollback; disable deployment and use controlled financial corrections');
}
