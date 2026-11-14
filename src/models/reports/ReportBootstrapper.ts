import KnexConnection from '../../database/KnexConnections';
import { ensureReportSchema } from './ReportSchema';

/** Creates the saved-report tables for one tenant. Safe to run on every application start. */
export async function bootstrapReportTables(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     await ensureReportSchema(db);
}
