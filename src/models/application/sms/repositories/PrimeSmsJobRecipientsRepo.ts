import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsJobRecipient {
     recid?: number;
     jobid: number;
     phonee164: string;
     personalizedbody: string;
     deliverystatus?: 'queued' | 'sent' | 'failed' | 'retrying';
     sentat?: Date;
     errorcode?: string;
}

export class PrimeSmsJobRecipientsRepo {
     private connection;
     private tablename = "primesmsjobrecipients";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsJobRecipient): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('recid');
          return id;
     }

     async findById(recid: number): Promise<PrimeSmsJobRecipient | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ recid }).first();
          return result || null;
     }

     async findAllByJob(jobid: number): Promise<PrimeSmsJobRecipient[]> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ jobid }).select();
     }

     async update(recid: number, data: Partial<PrimeSmsJobRecipient>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ recid }).update(data);
     }

     async delete(recid: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ recid }).del();
     }
}
