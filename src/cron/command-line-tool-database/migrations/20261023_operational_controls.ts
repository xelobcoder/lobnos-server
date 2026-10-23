import type { Knex } from 'knex';
import { ensureOperationalControls } from '../../../models/operations/OperationalControlsBootstrapper';
export async function up(db: Knex) { await ensureOperationalControls(db); }
export async function down() { /* Preserve workflow evidence and release holds. */ }
