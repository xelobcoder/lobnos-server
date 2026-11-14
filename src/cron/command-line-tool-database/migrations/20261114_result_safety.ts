import { Knex } from 'knex';
import { ensureResultSafetySchema } from '../../../models/results/ResultSafetySchema';

export async function up(db: Knex): Promise<void> {
    await ensureResultSafetySchema(db);
}

export async function down(_db: Knex): Promise<void> {
    /* Delta rules and safety events are clinical audit data; never drop them on rollback. */
}
