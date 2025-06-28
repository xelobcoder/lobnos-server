import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsTemplate {
     templateid?: number;
     name: string;
     body: string;
     category: 'patient' | 'clinician' | 'organization';
     createdby: number;
     createdat?: Date;
}

export class PrimeSmsTemplatesRepo {
     private connection;
     private tablename = "primesmstemplates";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsTemplate): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('templateid');
          return id;
     }

     async findById(templateid: number): Promise<PrimeSmsTemplate | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ templateid }).first();
          return result || null;
     }

     async findAll(): Promise<PrimeSmsTemplate[]> {
          const connection = await this.connection;
          return await connection(this.tablename).select();
     }

     async update(templateid: number, data: Partial<PrimeSmsTemplate>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ templateid }).update(data);
     }

     async delete(templateid: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ templateid }).del();
     }
}
