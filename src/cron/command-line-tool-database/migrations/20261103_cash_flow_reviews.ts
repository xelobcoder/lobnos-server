import { Knex } from 'knex';
import { ensureCashFlowReviewSchema } from '../../../accountingModule/init/cashFlowSchema';

export async function up(db: Knex): Promise<void> {
     await ensureCashFlowReviewSchema(db);
     await ensureCashFlowReviewSchema(db, true);
}
export async function down(_db: Knex): Promise<void> {
     throw new Error('Reviewed financial classification history must not be deleted; use a forward correction');
}
