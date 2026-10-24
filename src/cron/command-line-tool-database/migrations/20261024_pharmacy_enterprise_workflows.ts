import {Knex} from 'knex';
import {ensurePharmacyEnterpriseSchema} from '../../../models/pharmacy/PharmacyEnterpriseSchema';
export const up=(db:Knex)=>ensurePharmacyEnterpriseSchema(db);
export async function down(_db:Knex):Promise<void>{/* Preserve financial, clinical and inventory audit records. */}
