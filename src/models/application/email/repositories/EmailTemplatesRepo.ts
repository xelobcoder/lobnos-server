import KnexConnection from '../../../../database/KnexConnections';
import { EmailTemplateRecord } from '../types/EmailModels';

export class EmailTemplatesRepo {
     private connection;
     private tableName = 'email_templates';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: EmailTemplateRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async update(id: number, data: Partial<EmailTemplateRecord>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).update(data);
     }

     async findById(id: number): Promise<EmailTemplateRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName).where({ id }).first();
          return record || null;
     }

     async findAll(): Promise<EmailTemplateRecord[]> {
          const connection = await this.connection;
          return connection(this.tableName).select('*').orderBy('id', 'desc');
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).del();
     }
}
