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
               const { startDate, endDate, commissionDue, amountPaid, paymentMethod, employeeid, recipientid, recipient_type } = request.body;
               const startDateObj = new Date(startDate);
               const endDateObj = new Date(endDate);
               if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return customError("Invalid date format", 400, response);
               }
               if (startDateObj > endDateObj) {
                    return customError("Start date cannot be after end date", 400, response);
               }

               const isBatched: boolean | Array<number> = await batchServicesRepo.isDateRangeBatched(startDate, endDate,recipientid,recipient_type);

               if (typeof isBatched === "boolean" && isBatched === true) {
                    return customError("Some services have in the specified date range have already been batched for commission payment and processed ", 400, response);
               }


               const processPayment = await new CommissionBatchPaymentsRepo(this.tenantId).createBatchPaymentWithServices({
                    startDate: startDateObj,
                    endDate: endDateObj,
                    commissionDue,
                    amountPaid,
                    services: isBatched as Array<number>,
                    employeeid,
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
               const { batchid, recipient_id, recipient_type,startDate,endDate } = request.query;

               const batchPaymentsRepo = new CommissionBatchPaymentsRepo(this.tenantId);
               const batchInfo = await batchPaymentsRepo.getBatch
                    (
                         {
                              batchid: parseInt(batchid as string),
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
}