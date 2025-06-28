import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsCategoryMapping {
     id?: number;
     category: 'patient' | 'clinician' | 'organization';
     tablename: string;
     idcolumn: string;
     phonecolumn?: string;
     namecolumn?: string;
     additionalfields?: any;
}

export class PrimeSmsCategoryMappingsRepo {
     private connection;
     private tablename = "primesmscategorymappings";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsCategoryMapping): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('id');
          return id;
     }

     async findById(id: number): Promise<PrimeSmsCategoryMapping | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ id }).first();
          return result || null;
     }

     async findAll(): Promise<PrimeSmsCategoryMapping[]> {
          const connection = await this.connection;
          return await connection(this.tablename).select();
     }

     async update(id: number, data: Partial<PrimeSmsCategoryMapping>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).update(data);
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).del();
     }
}
