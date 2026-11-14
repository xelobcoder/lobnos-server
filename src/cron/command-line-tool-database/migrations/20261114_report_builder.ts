import { Knex } from 'knex';
import { ensureReportSchema } from '../../../models/reports/ReportSchema';

export async function up(db: Knex): Promise<void> {
    await ensureReportSchema(db);
}

export async function down(_db: Knex): Promise<void> {
    /* Saved report definitions are user data; never drop them on rollback. */
}
