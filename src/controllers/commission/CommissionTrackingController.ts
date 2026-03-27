import { Request, Response } from "express";
import { customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { CommissionTrackingRepo } from "../../models/commissions/CommissionTrackingRepository";
import { wrapperTryCatch } from "../../models/generics/trycatch";
import { CommissionBatchPaymentServicesRepo } from "../../models/commissions/CommissionBatchPaymentServicesRepo";
import KnexConnection from "../../database/KnexConnections";

export class CommissionTrackingController {
     private commissionTrackingRepo: CommissionTrackingRepo;
     private batchServicesRepo: CommissionBatchPaymentServicesRepo;
     private connection: any;


     constructor(tenantId: number) {
          this.commissionTrackingRepo = new CommissionTrackingRepo(tenantId);
          this.batchServicesRepo = new CommissionBatchPaymentServicesRepo(tenantId);
          this.connection = KnexConnection(tenantId);
     }


     async getCommissionTrackingByType(request: Request, response: Response) {
          const commissionTrackingRepo = this.commissionTrackingRepo;
          async function validate() {
               const { registrationType, page, count, recipient_id } = request.query
               if (registrationType && !['clinician', 'organization'].includes(registrationType as string)) {
                    return customError("Type must be either 'clinician' or 'organization'", 400, response);
               }
               try {
                    const tracking = await commissionTrackingRepo.getCommissionTrackingByType
                         (
                              registrationType as 'clinician' | 'organization',
                              page ? parseInt(page.toString()) : undefined,
                              count ? parseInt(count.toString()) : undefined,
                              recipient_id ? parseInt(recipient_id.toString()) : undefined
                         );

                    return response.send({
                         status: true,
                         message: "Commission tracking retrieved successfully",
                         data: tracking
                    });
               } catch (error) {
                    logger.error('Error fetching commission tracking by type:', error);
                    return customError("Failed to fetch commission tracking", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }


     async updateCommissionTracking(request: Request, response: Response) {
          try {
               const { id } = request.params;
               const { serviceid, commissionRate, recipientType, recipientId } = request.body;

               if (!serviceid || !commissionRate || !recipientType || !recipientId) {
                    return customError("Missing required fields", 400, response);
               }

               if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
                    return customError("Commission rate must be a number between 0 and 100", 400, response);
               }

               const commissionId = parseInt(id);
               const commissionTrackingRepo = this.commissionTrackingRepo;
               const batchServicesRepo = this.batchServicesRepo;
               const conn = await this.connection;
               const isBatched = await batchServicesRepo.isServiceBatched(serviceid);

               if (isBatched) return customError("Cannot update commission rate for a service that is already included in a batch payment", 400, response);

               const totalpayable = await conn('dboservices')
                    .where('serviceid', serviceid)
                    .first()
                    .then((row: any) => row ? parseFloat(row.totalpayable) : 0);

               const newCommissionAmount = parseFloat(((totalpayable * commissionRate) / 100).toFixed(2));
               const updates = {
                    commission_percentage: commissionRate,
                    type: recipientType,
                    recipient_id: recipientId,
                    commission_due: newCommissionAmount,
                    calculated_at: new Date(),
                    updated_at: new Date()
               };

               await commissionTrackingRepo.updateCommissionTracking(commissionId, updates);
               return response.send({
                    status: true,
                    message: "Commission tracking updated successfully"
               });
          } catch (error) {
               logger.error('Error updating commission tracking:', error);
               return customError("Failed to update commission tracking", 500, response);
          }
     }
}