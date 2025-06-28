import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsPlaceholderRule {
     id?: number;
     category: 'patient' | 'clinician' | 'organization';
     placeholder: string;
     columnname: string;
     tablename: string;
     description?: string;
}

export class PrimeSmsPlaceholderRulesRepo {
     private connection;
     private tablename = "primesmsplaceholderrules";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsPlaceholderRule): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('id');
          return id;
     }

     async findById(id: number): Promise<PrimeSmsPlaceholderRule | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ id }).first();
          return result || null;
     }

     async findAll(): Promise<PrimeSmsPlaceholderRule[]> {
          const connection = await this.connection;
          return await connection(this.tablename).select();
     }

     async update(id: number, data: Partial<PrimeSmsPlaceholderRule>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).update(data);
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).del();
     }
}
