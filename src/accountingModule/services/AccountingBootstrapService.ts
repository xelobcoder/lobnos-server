import { ensureAccountingSchema } from '../init/accountingSchemaInit';

export async function bootstrapAccountingTables(tenantId = 1): Promise<void> {
     await ensureAccountingSchema(tenantId);
}
