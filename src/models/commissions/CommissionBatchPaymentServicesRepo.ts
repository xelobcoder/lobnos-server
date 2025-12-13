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




     async getUnbatchedServicesFromList(serviceIds: Array<number>): Promise<Array<number>> {
          try {
               const conn = await this.connection;

               const existingServices = await conn('dboservices')
                    .whereIn('serviceid', serviceIds)
                    .select('serviceid');
               const existingIds = existingServices.map((row: any) => row.serviceid);

               const invalidIds = serviceIds.filter(id => !existingIds.includes(id));
               if (invalidIds.length > 0) {
                    throw new Error(`Invalid service IDs: ${invalidIds.join(', ')}. These services do not exist in the database.`);
               }

               const batchedServices = await conn('commission_batch_payment_services')
                    .whereIn('serviceid', serviceIds)
                    .select('serviceid');
               const batchedIds = batchedServices.map((row: any) => row.serviceid);

               if (batchedIds.length > 0) {
                    throw new Error(`Some services have already been batched for commission payment: ${batchedIds.join(', ')}. Cannot proceed with this batch.`);
               }

               if (serviceIds.length > 0) {
                    for (const serviceId of serviceIds) {
                         const notCommissioned = await new CommissionTrackingRepo(this.tenantId).validateServiceTrackedMultiple([serviceId]);
                         if (notCommissioned.length > 0) {
                              await new CommissionTrackingRepo(this.tenantId).calculateCommissionDue(notCommissioned);
                         }
                    }
               }
               return serviceIds;
          } catch (error) {
               logger.error('Error getting unbached services from list:', error);
               throw error;
          }
     }
     getsServicePaymentHistory = async (serviceid: number) => {
          try {
               const conn = await this.connection;
               const paymentHistory = await conn('commission_batch_payment_services as cbps')
                    .leftJoin("commission_tracking as ct", "ct.serviceid", "cbps.serviceid ")
                    .select(("cbps.*"), ("ct.commission_percentage"), ("ct.type"), ("ct.recipient_id"))
                    .where('cbps.serviceid', serviceid);
               return paymentHistory;
          } catch (error) {
               logger.error('Error fetching service payment history:', error);
               throw error;
          }
     }

     getBatchPaymentServices = async (batchid: number) => {
          try {
               const conn = await this.connection;
               const services = await conn('commission_batch_payment_services as cbps')
                    .leftJoin("commission_tracking as ct", "ct.serviceid", "cbps.serviceid ")
                    .select(("cbps.*"), ("ct.commission_percentage"), ("ct.type"), ("ct.recipient_id"))
                    .where('cbps.batch_payment_id', batchid);
               return services;
          } catch (error) {
               logger.error('Error fetching batch payment services:', error);
               throw error;
          }
     }
}