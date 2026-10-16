import KnexConnection from '../../../../database/KnexConnections';
import { EmailProviderRecord } from '../types/EmailModels';
import { decryptSecret, encryptSecret } from '../helpers/emailSecretCipher';

/** Passwords are encrypted at rest; rows returned by this repo carry the decrypted password for internal sending only. */
function decryptRow<T extends { password?: string } | null | undefined>(row: T): T {
     if (!row || !row.password) return row;
     return { ...row, password: decryptSecret(row.password) };
}

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
          const result = await connection(this.tableName).insert({ ...data, password: encryptSecret(data.password) });
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async update(id: number, data: Partial<EmailProviderRecord>): Promise<number> {
          const connection = await this.connection;
          if (data.is_default) {
               await connection(this.tableName).whereNot({ id }).update({ is_default: false });
          }
          const payload = data.password ? { ...data, password: encryptSecret(data.password) } : data;
          return connection(this.tableName).where({ id }).update(payload);
     }

     async findById(id: number): Promise<EmailProviderRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName).where({ id }).first();
          return decryptRow(record) || null;
     }

     async findDefault(): Promise<EmailProviderRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName)
               .where({ is_default: true, is_active: true })
               .first();
          return decryptRow(record) || null;
     }

     async findAll(page?: number, count?: number): Promise<EmailProviderRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .select('*')
               .orderBy('id', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          const rows: EmailProviderRecord[] = await query;
          return rows.map((row) => decryptRow(row));
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).del();
     }
}
