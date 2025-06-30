
import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsJobRecipient {
     recid?: number;
     jobid: number;
     phonee164: string;
     personalizedbody: string;
     deliverystatus?: 'queued' | 'sent' | 'failed' | 'retrying';
     sentat?: Date;
     errorcode?: string;
     refid: number;
     messageid?: string | null;
}

export class PrimeSmsJobRecipientsRepo {
     private connection;
     private tablename = "primesmsjobrecipients";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findByJobAndRefids(jobid: number, refids: (number | string)[]): Promise<PrimeSmsJobRecipient[]> {
          if (!refids || refids.length === 0) return [];
          const connection = await this.connection;
          return await connection(this.tablename)
               .where({ jobid })
               .whereIn('refid', refids)
               .select();
     }

     async findOneByJobRefid(jobid: number, refid: number | string): Promise<PrimeSmsJobRecipient | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename)
               .where({ jobid, refid })
               .first();
          return result || null;
     }

     async create(data: PrimeSmsJobRecipient): Promise<number> {
          const connection = await this.connection;
          await connection(this.tablename).insert(data);
          return null;
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

     async findAllByJobPaginated(jobid: number, page: number = 1, count: number = 20): Promise<PrimeSmsJobRecipient[]> {
          const connection = await this.connection;
          return await connection(this.tablename)
               .where({ jobid })
               .limit(count)
               .offset((page - 1) * count)
               .select();
     }

     async update(recid: number, data: Partial<PrimeSmsJobRecipient>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ recid }).update(data);
     }

     async delete(recid: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ recid }).del();
     }

     async bulkInsert(jobid: number, recipients: Omit<PrimeSmsJobRecipient, 'jobid'>[], trx: any): Promise<number[]> {
          const connection = await trx || this.connection;
          const rows = recipients.map(r => {
               return { ...r, jobid }
          });
          await connection(this.tablename).insert(rows);
          return [];
     }

     async updateDeliveryStatusByPhone(
          jobid: number,
          phonee164: string,
          status: 'queued' | 'sent' | 'failed' | 'retrying',
          arkeselId?: string | null
     ): Promise<number> {
          const connection = await this.connection;
          const updateData: Partial<PrimeSmsJobRecipient> = {
               deliverystatus: status,
               sentat: new Date(),
          };
          if (arkeselId) updateData.messageid = arkeselId;
          return await connection(this.tablename)
               .where({ jobid, phonee164 })
               .update(updateData);

     }
}
