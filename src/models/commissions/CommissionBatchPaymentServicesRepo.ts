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


     async isDateRangeBatched(startDate: string, endDate: string, recipient_id: number, recipient_type: 'clinician' | 'organization'): Promise<boolean | Array<number>> {
          try {
               //  get all serviceid within the date range
               const conn = await this.connection;
               let query = conn('dboservices')
                    .whereRaw('DATE(serviceAddedOn) >= ?', [startDate])
                    .whereRaw('DATE(serviceAddedOn) <= ?', [endDate]);
               const parsedId = parseInt(recipient_id as any, 10);
               if (recipient_type === 'clinician') {
                    query = query.whereNotNull('clinicianId').andWhere('serviceCategory', 'CLINICIAN_SPECIAL_BILLING').andWhere('clinicianId', parsedId);
               } else if (recipient_type === 'organization') {
                    query = query.whereNotNull('organizationId').andWhere('serviceCategory', 'ORGANIZATION').andWhere('organizationId', parsedId);
               }

               console.log(query.toString());
               const results = await query;
               if (results.length === 0) {
                    throw new Error('No services found in the specified date range');
               }
               const serviceIds = results.map((row: any) => row.serviceid);
               const isBatched = await conn('commission_batch_payment_services')
                    .whereIn('serviceid', serviceIds)
                    .first();

               if (isBatched) return true
               const allNotCommissioned = await new CommissionTrackingRepo(this.tenantId).validateServiceTrackedMultiple(serviceIds);
               if (allNotCommissioned.length > 0) {
                    await new CommissionTrackingRepo(this.tenantId).calculateCommissionDue(allNotCommissioned);
               }
               return serviceIds;
          } catch (error) {
               logger.error('Error validating date range:', error);
               throw error;
          }
     }
}