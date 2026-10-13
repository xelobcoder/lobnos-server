import KnexConnection from '../../../../database/KnexConnections';
import { SmsProviderRecord } from '../types/SmsProviderModels';

const SETTINGS_ID = 1;

export class SmsProviderSettingsRepo {
     constructor(private tenantId: number) { }

     async find(): Promise<SmsProviderRecord | null> {
          const connection = await KnexConnection(this.tenantId);
          return (await connection<SmsProviderRecord>('sms_provider_settings').where({ id: SETTINGS_ID }).first()) ?? null;
     }

     async save(data: Omit<SmsProviderRecord, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
          const connection = await KnexConnection(this.tenantId);
          await connection('sms_provider_settings')
               .insert({ id: SETTINGS_ID, ...data })
               .onConflict('id')
               .merge({ ...data, updated_at: connection.fn.now() });
     }
}
