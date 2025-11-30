import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import { CommissionTrackingRepo } from "./CommissionTrackingRepository";

interface CommissionBatchPaymentService {
     id?: number;
     batch_payment_id: number;
     serviceid: number;
     commission_due: number;
     amount_allocated: number;
     waived_amount: number;
     status: 'paid' | 'partial' | 'waived';
     created_at?: Date;
}

export class CommissionBatchPaymentServicesRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async isServiceBatched(serviceid: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('commission_batch_payment_services')
                    .where('serviceid', serviceid)
                    .first();
               return !!result;
          } catch (error) {
               logger.error('Error checking if service is batched:', error);
               throw error;
          }
     }


     async isDateRangeBatched(startDate: string, endDate: string): Promise<boolean> {
          try {
               //  get all serivesid within the date range
               const conn = await this.connection;
               const results = await conn.raw(`
                    SELECT * FROM dboservices
                    WHERE DATE(serviceAddedOn) >= ? AND DATE(serviceAddedOn) <= ?
               `, [startDate, endDate]);
               if (results[0].length === 0) {
                    throw new Error('No services found in the specified date range');
               }
               const serviceIds = results[0].map((row: any) => row.serviceid);
               const isBatched = await conn('commission_batch_payment_services')
                    .whereIn('serviceid', serviceIds)
                    .first();

               if (isBatched) return true
               const allNotCommissioned = await new CommissionTrackingRepo(this.tenantId).validateServiceTrackedMultiple(serviceIds);
               if (allNotCommissioned.length > 0) {
                    const createCommmission = await new CommissionTrackingRepo(this.tenantId).calculateCommissionDue(allNotCommissioned);
                    console.log("Commission created for untracked services during batching validation: ", createCommmission);
               }
               return false;
          } catch (error) {
               logger.error('Error validating date range:', error);
               throw error;
          }
     }
}