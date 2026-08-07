import KnexConnection from '../../../../database/KnexConnections';
import { EmailSettingsRecord } from '../types/EmailModels';

export class EmailSettingsRepo {
     private connection;
     private tableName = 'email_settings';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async get(): Promise<EmailSettingsRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName).first();
          return record || null;
     }

     async upsert(data: Partial<EmailSettingsRecord>): Promise<void> {
          const connection = await this.connection;
          const current = await this.get();
          if (!current) {
               await connection(this.tableName).insert({
                    default_provider_id: null,
                    max_attachment_size_mb: 10,
                    max_retries: 3,
                    retry_backoff_minutes_json: JSON.stringify([2, 10, 30]),
                    allow_marketing_emails: true,
                    ...data,
               });
               return;
          }

          await connection(this.tableName).where({ id: current.id }).update(data);
     }
}
