import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsEvent {
     eventid?: number;
     code: string;
     description?: string;
     category: 'patient' | 'clinician' | 'organization';
     createdat?: Date;
}

export class PrimeSmsEventsRepo {
     private connection;
     private tablename = "primesmsevents";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsEvent): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('eventid');
          return id;
     }

     async findById(eventid: number): Promise<PrimeSmsEvent | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ eventid }).first();
          return result || null;
     }

     async findAll(): Promise<PrimeSmsEvent[]> {
          const connection = await this.connection;
          return await connection(this.tablename).select();
     }

     async update(eventid: number, data: Partial<PrimeSmsEvent>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ eventid }).update(data);
     }

     async delete(eventid: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ eventid }).del();
     }
}
