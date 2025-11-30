import { custom } from "zod";
import { CommissionBatchPaymentServicesRepo } from "../../models/commissions/CommissionBatchPaymentServicesRepo";
import { Request, Response } from "express";
import { customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { CommissionTrackingRepo } from "../../models/commissions/CommissionTrackingRepository";
export class CommissionBatchServicesController {
     batchServicesRepo: any;
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }


     processServiceBatching = async (request: Request<{}, {}, { startDate: string; endDate: string; commissionDue: number; amountPaid: number }>, response: Response) => {
          try {
               const batchServicesRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const { startDate, endDate, commissionDue, amountPaid } = request.body;
               //  validate the dates andd ensure there are actual dates 
               const startDateObj = new Date(startDate);
               const endDateObj = new Date(endDate);
               if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return customError("Invalid date format", 400, response);
               }
               if (startDateObj > endDateObj) {
                    return customError("Start date cannot be after end date", 400, response);
               }
               // get all services within the date range that match the commission type

               const isBatched = await batchServicesRepo.isDateRangeBatched(startDate, endDate);

               if (isBatched) {
                    return customError("Some services have in the specified date range have already been batched for commission payment and processed ", 400, response);
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
}