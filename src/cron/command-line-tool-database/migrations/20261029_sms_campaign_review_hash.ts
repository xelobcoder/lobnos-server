import type { Knex } from 'knex';
import { ensureSmsCampaignSchema } from '../../../models/application/sms/SmsCampaignSchema';

export const up = (db: Knex) => ensureSmsCampaignSchema(db);
export async function down(_db: Knex): Promise<void> { /* Keep campaign review evidence. */ }
