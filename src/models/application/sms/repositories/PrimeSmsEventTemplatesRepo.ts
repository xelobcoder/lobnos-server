import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsEventTemplate {
     id?: number;
     eventid: number;
     templateid: number;
     isactive?: boolean;
}

export class PrimeSmsEventTemplatesRepo {
     private connection;
     private tablename = "primesmseventtemplates";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsEventTemplate): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('id');
          return id;
     }

     async findById(id: number): Promise<PrimeSmsEventTemplate | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ id }).first();
          return result || null;
     }

     async findAllByEvent(eventid: number): Promise<PrimeSmsEventTemplate[]> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ eventid }).select();
     }

     async findAllByTemplate(templateid: number): Promise<PrimeSmsEventTemplate[]> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ templateid }).select();
     }

     async update(id: number, data: Partial<PrimeSmsEventTemplate>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).update(data);
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).del();
     }
}
