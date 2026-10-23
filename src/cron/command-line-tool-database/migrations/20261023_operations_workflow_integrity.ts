import { Knex } from 'knex';
import { ensureOperationsWorkflowSchema } from '../../../models/operations/OperationsWorkflowBootstrapper';
export async function up(db: Knex): Promise<void> { await ensureOperationsWorkflowSchema(db); }
// Operational audit records are intentionally retained on rollback.
export async function down(): Promise<void> { }
