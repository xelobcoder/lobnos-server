import { ensureAccountingSchema } from '../init/accountingSchemaInit';
import { ensureAuthorityTable } from './AuthorityService';
import { ensureBankTables } from './BankReconciliationService';
import { ensureFinanceLedgerTables } from '../../services/finance/financeLedgerInit';

export async function bootstrapAccountingTables(tenantId = 1): Promise<void> {
     await ensureAccountingSchema(tenantId);
     await ensureAuthorityTable(tenantId);
     await ensureBankTables(tenantId);
     await ensureFinanceLedgerTables(tenantId);
}
