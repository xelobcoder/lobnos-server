import { CommissionBatchPaymentServicesRepo } from "../../models/commissions/CommissionBatchPaymentServicesRepo";
import { Request, Response } from "express";
import { customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { CommissionBatchPaymentsRepo } from "../../models/commissions/CommissionBatchPaymentsRepo";

interface ServiceBatchingRequestBody {
     startDate: string;
     endDate: string;
     commissionDue: number;
     amountPaid: number;
     paymentMethod: string;
     employeeid: number;
     branchid: number;
     services: Array<number>;
     recipientid: number;
     recipient_type: 'clinician' | 'organization'
}


export class CommissionBatchServicesController {
     batchServicesRepo: any;
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }


     processServiceBatching = async (request: Request<{}, {}, ServiceBatchingRequestBody>, response: Response) => {
          try {
               const batchServicesRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const { startDate, endDate, commissionDue, amountPaid, paymentMethod, employeeid, branchid, recipientid, recipient_type, services } = request.body;

               const parseDate = (dateStr: string): Date => {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                         const day = parseInt(parts[0], 10);
                         const month = parseInt(parts[1], 10);
                         const year = parseInt(parts[2], 10);
                         return new Date(year, month - 1, day);
                    }
                    return new Date(dateStr);
               };

               const startDateObj = parseDate(startDate);
               const endDateObj = parseDate(endDate);
               if (!branchid || !employeeid || !recipientid || !recipient_type) {
                    return customError("Missing required fields: branchid, employeeid, recipientid, recipient_type", 400, response);
               }
               if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return customError("Invalid date format", 400, response);
               }
               if (startDateObj > endDateObj) {
                    return customError("Start date cannot be after end date", 400, response);
               }

               const eligibleServices = await batchServicesRepo.getUnbatchedServicesFromList(services);

               if (eligibleServices.length === 0) {
                    return customError("No eligible services from the provided list", 400, response);
               }

               logger.info(`Processing batch payment for ${eligibleServices.length} eligible services: ${eligibleServices.join(', ')}`);

               const processPayment = await new CommissionBatchPaymentsRepo(this.tenantId).createBatchPaymentWithServices({
                    startDate: startDateObj,
                    endDate: endDateObj,
                    commissionDue,
                    amountPaid,
                    services: eligibleServices,
                    employeeid,
                    branchid,
                    paymentMethod,
                    recipientId: recipientid,
                    recipientType: recipient_type
               });

               if (!processPayment) {
                    return customError("Failed to process service batching", 500, response);
               }

               return response.send({
                    status: true,
                    message: "Service batching validation successful. Services can be batched.",
                    data: {}
               });

          } catch (error) {
               logger.error('Error processing service batching:', error);
               return false;
          }
     }


     async getBatchInformation(request: Request, response: Response) {
          try {
               const { batchid, recipient_id, recipient_type, startDate, endDate, page, count, sortby } = request.query;

               const batchPaymentsRepo = new CommissionBatchPaymentsRepo(this.tenantId);
               const batchInfo = await batchPaymentsRepo.getBatch
                    (
                         {
                              batchid: parseInt(batchid as string),
                              page: page ? parseInt(page as string) : 1,
                              count: count ? parseInt(count as string) : 10,
                              sortby: sortby === 'ASC' ? 'ASC' : 'DESC',
                              startDate: startDate ? new Date(startDate as string) : undefined,
                              endDate: endDate ? new Date(endDate as string) : undefined,
                              recipient_id: recipient_id ? parseInt(recipient_id as string) : undefined,
                              recipient_type: recipient_type ? recipient_type as 'clinician' | 'organization' : undefined
                         }
                    )
               return response.send({
                    status: true,
                    message: "Batch information retrieved successfully",
                    data: batchInfo
               });
          }
          catch (error) {
               logger.error('Error fetching batch information:', error);
               return customError("Failed to fetch batch information", 500, response);
          }
     }


     async getServiceCommissionPaymentHistory(request: Request, response: Response) {
          try {
               const { serviceid } = request.params;
               const commissionTrackingRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const paymentHistory = await commissionTrackingRepo.getsServicePaymentHistory(parseInt(serviceid.toString()));
               return response.send({
                    status: true,
                    message: "Service commission payment history retrieved successfully",
                    data: paymentHistory
               });
          }
          catch (error) {
               logger.error('Error fetching service commission payment history:', error);
               return customError("Failed to fetch service commission payment history", 500, response);
          }
     }


     getBatchBreakdown = async (request: Request, response: Response) => {
          try {
               const { batchid } = request.params;
               const batchPaymentsRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const batchBreakdown = await batchPaymentsRepo.getBatchPaymentServices(parseInt(batchid.toString()));
               return response.send({
                    status: true,
                    message: "Batch breakdown retrieved successfully",
                    data: batchBreakdown
               });
          } catch (error) {
               logger.error('Error fetching batch breakdown:', error);
               return customError("Failed to fetch batch breakdown", 500, response);
          }
     }
}