import { encryptSmsSecret, decryptSmsSecret } from '../SmsSecretCipher';
import KnexConnection from '../../../../database/KnexConnections';
import { SmsProviderRecord } from '../types/SmsProviderModels';

const SETTINGS_ID = 1;

export class SmsProviderSettingsRepo {
     constructor(private tenantId: number) { }

     async find(): Promise<SmsProviderRecord | null> {
          const connection = await KnexConnection(this.tenantId);
          const row = await connection<SmsProviderRecord>('sms_provider_settings').where({id:SETTINGS_ID}).first();
          return row ? {...row, api_key:decryptSmsSecret(row.api_key), webhook_secret:row.webhook_secret ? decryptSmsSecret(row.webhook_secret) : null} : null;
     }

     async save(data: Omit<SmsProviderRecord, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
          const connection = await KnexConnection(this.tenantId);
          await connection('sms_provider_settings')
               .insert({ id: SETTINGS_ID, ...data, api_key:encryptSmsSecret(data.api_key), webhook_secret:data.webhook_secret ? encryptSmsSecret(data.webhook_secret) : null })
               .onConflict('id')
               .merge({ ...data, api_key:encryptSmsSecret(data.api_key), webhook_secret:data.webhook_secret ? encryptSmsSecret(data.webhook_secret) : null, updated_at: connection.fn.now() });
     }
}
