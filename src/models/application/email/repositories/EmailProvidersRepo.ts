import KnexConnection from '../../../../database/KnexConnections';
import { EmailProviderRecord } from '../types/EmailModels';

export class EmailProvidersRepo {
     private connection;
     private tableName = 'email_providers';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: EmailProviderRecord): Promise<number> {
          const connection = await this.connection;
          if (data.is_default) {
               await connection(this.tableName).update({ is_default: false });
          }
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async update(id: number, data: Partial<EmailProviderRecord>): Promise<number> {
          const connection = await this.connection;
          if (data.is_default) {
               await connection(this.tableName).whereNot({ id }).update({ is_default: false });
          }
          return connection(this.tableName).where({ id }).update(data);
     }

     async findById(id: number): Promise<EmailProviderRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName).where({ id }).first();
          return record || null;
     }

     async findDefault(): Promise<EmailProviderRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName)
               .where({ is_default: true, is_active: true })
               .first();
          return record || null;
     }

     async findAll(): Promise<EmailProviderRecord[]> {
          const connection = await this.connection;
          return connection(this.tableName).select('*').orderBy('id', 'desc');
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).del();
     }
}
