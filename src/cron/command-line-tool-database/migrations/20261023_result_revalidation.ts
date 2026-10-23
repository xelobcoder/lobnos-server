import type { Knex } from 'knex';
import { ensureOperationsWorkflowSchema } from '../../../models/operations/OperationsWorkflowBootstrapper';
export async function up(db: Knex) { await ensureOperationsWorkflowSchema(db); }
export async function down() { /* Preserve revision safety and validation history. */ }
