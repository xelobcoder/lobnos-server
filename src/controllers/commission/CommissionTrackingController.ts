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
               const { serviceId, newCommissionAmount:commissionRate, recipientType, recipientId } = request.body;

               if (!serviceId || !commissionRate || !recipientType || !recipientId) {
                    return customError("Missing required fields", 400, response);
               }

               if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
                    return customError("Commission rate must be a number between 0 and 100", 400, response);
               }

               const commissionId = parseInt(id.toString());
               const commissionTrackingRepo = this.commissionTrackingRepo;
               const batchServicesRepo = this.batchServicesRepo;
               const conn = await this.connection;
               const isBatched = await batchServicesRepo.isServiceBatched(serviceId);

               if (isBatched) return customError("Cannot update commission rate for a service that is already included in a batch payment", 400, response);

               const totalpayable = await conn('dboservices')
                    .where('serviceid', serviceId)
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

     async getUntrackedServices(request: Request, response: Response) {
          try {
               const { recipient_type, recipient_id, page, count } = request.query;

               let recipientType: 'clinician' | 'organization' | undefined;
               let recipientId: number | undefined;
               let pageNum: number | undefined;
               let countNum: number | undefined;

               if (recipient_type) {
                    if (!['clinician', 'organization'].includes(recipient_type as string)) {
                         return customError("recipient_type must be either 'clinician' or 'organization'", 400, response);
                    }
                    recipientType = recipient_type as 'clinician' | 'organization';
               }

               if (recipient_id) {
                    const parsedId = parseInt(recipient_id as string);
                    if (isNaN(parsedId)) {
                         return customError("recipient_id must be a valid number", 400, response);
                    }
                    recipientId = parsedId;
               }

               if (page) {
                    const parsedPage = parseInt(page as string);
                    if (isNaN(parsedPage) || parsedPage < 1) {
                         return customError("page must be a positive integer", 400, response);
                    }
                    pageNum = parsedPage;
               }

               if (count) {
                    const parsedCount = parseInt(count as string);
                    if (isNaN(parsedCount) || parsedCount < 1) {
                         return customError("count must be a positive integer", 400, response);
                    }
                    countNum = parsedCount;
               }

               const untrackedServices = await this.commissionTrackingRepo.getUntrackedServices(
                    recipientType,
                    recipientId,
                    pageNum,
                    countNum
               );

               return response.send({
                    status: true,
                    message: "Untracked services retrieved successfully",
                    data: untrackedServices
               });
          } catch (error) {
               logger.error('Error fetching untracked services:', error);
               return customError("Failed to fetch untracked services", 500, response);
          }
     }

     async addUntrackedService(request: Request, response: Response) {
          try {
               const { serviceid, recipient_type, recipient_id } = request.body;

               if (!serviceid || !recipient_type || !recipient_id) {
                    return customError("Missing required fields: serviceid, recipient_type, recipient_id", 400, response);
               }

               if (!['clinician', 'organization'].includes(recipient_type as string)) {
                    return customError("recipient_type must be either 'clinician' or 'organization'", 400, response);
               }

               const recipientId = parseInt(recipient_id.toString());
               if (isNaN(recipientId)) {
                    return customError("recipient_id must be a valid number", 400, response);
               }

               const serviceId = parseInt(serviceid.toString());
               if (isNaN(serviceId)) {
                    return customError("serviceid must be a valid number", 400, response);
               }

               const result = await this.commissionTrackingRepo.insertUntrackedService(
                    serviceId,
                    recipient_type as 'clinician' | 'organization',
                    recipientId
               );

               return response.send({
                    status: true,
                    message: "Untracked service inserted successfully",
                    data: result
               });
          } catch (error: any) {
               logger.error('Error inserting untracked service:', error);
               return customError(error?.message || "Failed to insert untracked service", 500, response);
          }
     }
}