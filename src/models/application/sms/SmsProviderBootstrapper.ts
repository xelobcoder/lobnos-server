import { ensureSmsContactGroupSchema } from './SmsContactGroupSchema';
import { ensureArkeselSchema } from './ArkeselSchema';
import KnexConnection from '../../../database/KnexConnections';
import logger from '../../../hooks/logger';
import { ensureSmsCampaignSchema } from './SmsCampaignSchema';
import { up as createSmsProviderSettingsTable } from '../../../cron/command-line-tool-database/migrations/20261013_sms_provider_settings';

export async function bootstrapSmsProviderSettings(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     await createSmsProviderSettingsTable(connection);
     await ensureSmsCampaignSchema(connection);
     await ensureArkeselSchema(connection);
     await ensureSmsContactGroupSchema(connection);
     if (!(await connection('sms_provider_settings').where({ id: 1 }).first('id'))) {
          logger.warn(`[Bootstrap] Tenant ${tenantId} has no SMS provider configuration; SMS remains disabled until an owner configures it`);
     }
}
