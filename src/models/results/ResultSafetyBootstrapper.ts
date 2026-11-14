import KnexConnection from '../../database/KnexConnections';
import { ensureResultSafetySchema } from './ResultSafetySchema';

export async function bootstrapResultSafetyTables(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     await ensureResultSafetySchema(db);
}
