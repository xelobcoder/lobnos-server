import { Request, Response } from "express";
import { customError, responseError } from "../../hooks/helper";
import { wrapperTryCatch } from "../../models/generics/trycatch";
import { CommissionPaymentsRepository } from "../../repositories/CommissionPaymentsRepository";
import logger from "../../hooks/logger";

export class CommissionPaymentsController {
     private repo: CommissionPaymentsRepository;

     constructor(tenantId: number) {
          this.repo = new CommissionPaymentsRepository(tenantId);
     }

     private determinePaymentStatus(totalAmountPaid: number, commissionDue: number): 'pending' | 'paid' | 'overdue' | 'cancelled' {
          if (totalAmountPaid === 0) {
               return 'pending';
          }
          if (totalAmountPaid >= commissionDue) {
               return 'paid';
          }
          return 'pending'; // Partial payments remain pending
     }

     async createCommissionPayment(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               const {
                    serviceid,
                    commission_due,
                    amount_paid,
                    type,
                    trackid,
                    paymentmode,
                    paid_by
               } = request.body;

               if (!serviceid || !commission_due || !type) {
                    return customError("serviceid, commission_due, and type are required", 400, response);
               }

               if (!['clinician', 'organization'].includes(type)) {
                    return customError("type must be either 'clinician' or 'organization'", 400, response);
               }

               // Check if commission payment already exists for this service
               try {
                    const existingPayments = await controller.repo.getCommissionPaymentsByService(serviceid);
                    if (existingPayments.length > 0) {
                         const existingPayment = existingPayments[0]; // Get the first (and should be only) payment

                         // Debug logging
                         console.log('Existing payment found:', {
                              id: existingPayment.id,
                              serviceid: existingPayment.serviceid,
                              total_amount_paid: existingPayment.total_amount_paid,
                              commission_due: existingPayment.commission_due,
                              status: existingPayment.status,
                              type: typeof existingPayment.total_amount_paid,
                              type2: typeof existingPayment.commission_due
                         });

                         // Check if payment is already complete
                         const totalPaid = parseFloat(existingPayment.total_amount_paid?.toString() || '0');
                         const commissionDue = parseFloat(existingPayment.commission_due?.toString() || '0');

                         console.log('Comparison:', { totalPaid, commissionDue, isFullyPaid: totalPaid >= commissionDue });

                         // Check if status needs to be corrected
                         const correctStatus = controller.determinePaymentStatus(totalPaid, commissionDue);
                         if (existingPayment.status !== correctStatus) {
                              console.log(`Correcting status from ${existingPayment.status} to ${correctStatus}`);
                              await controller.repo.updateCommissionPaymentStatus(existingPayment.id, correctStatus);
                              existingPayment.status = correctStatus; // Update local object
                         }

                         if (totalPaid >= commissionDue) {
                              return customError("Commission payment is already fully paid for this service", 400, response);
                         }

                         // If amount_paid is provided and payment is not complete, add a transaction
                         if (amount_paid && amount_paid > 0) {
                              await controller.repo.createCommissionPaymentTransaction({
                                   commission_payment_id: existingPayment.id,
                                   amount_paid,
                                   trackid,
                                   paymentmode,
                                   paid_by
                              });

                              return response.send({
                                   status: true,
                                   message: "Payment transaction added to existing commission payment",
                                   data: { paymentId: existingPayment.id }
                              });
                         } else {
                              return customError("Commission payment already exists for this service. Provide amount_paid to add a transaction.", 400, response);
                         }
                    }
               } catch (error) {
                    logger.error('Error checking existing commission payment:', error);
                    return customError("Failed to validate existing commission payment", 500, response);
               }

               try {
                    // Determine initial status (always start with 0 paid)
                    const status = controller.determinePaymentStatus(0, commission_due);

                    const paymentId = await controller.repo.createCommissionPayment({
                         serviceid,
                         commission_due,
                         type,
                         status
                    });

                    // If amount_paid is provided, create a transaction
                    if (amount_paid && amount_paid > 0) {
                         await controller.repo.createCommissionPaymentTransaction({
                              commission_payment_id: paymentId,
                              amount_paid,
                              trackid,
                              paymentmode,
                              paid_by
                         });
                    }

                    return response.send({
                         status: true,
                         message: "Commission payment created successfully",
                         data: { paymentId }
                    });
               } catch (error) {
                    logger.error('Error creating commission payment:', error);
                    return customError("Failed to create commission payment", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPayment(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { id } = request.params;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!id || isNaN(parseInt(id))) {
                    return customError("Valid payment ID is required", 400, response);
               }

               try {
                    const payment = await controller.repo.getCommissionPaymentById(parseInt(id));

                    if (!payment) {
                         return customError("Commission payment not found", 404, response);
                    }

                    return response.send({
                         status: true,
                         message: "Commission payment retrieved successfully",
                         data: payment
                    });
               } catch (error) {
                    logger.error('Error fetching commission payment:', error);
                    return customError("Failed to fetch commission payment", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPaymentsByService(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { serviceId } = request.params;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!serviceId || isNaN(parseInt(serviceId))) {
                    return customError("Valid service ID is required", 400, response);
               }

               try {
                    const payments = await controller.repo.getCommissionPaymentsByService(parseInt(serviceId));

                    return response.send({
                         status: true,
                         message: "Commission payments retrieved successfully",
                         data: payments
                    });
               } catch (error) {
                    logger.error('Error fetching commission payments by service:', error);
                    return customError("Failed to fetch commission payments", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPaymentsByType(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { type } = request.params;
               const { limit } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!['clinician', 'organization'].includes(type)) {
                    return customError("Type must be either 'clinician' or 'organization'", 400, response);
               }

               try {
                    const payments = await controller.repo.getCommissionPaymentsByType(
                         type as 'clinician' | 'organization',
                         limit ? parseInt(limit.toString()) : undefined
                    );

                    return response.send({
                         status: true,
                         message: "Commission payments retrieved successfully",
                         data: payments
                    });
               } catch (error) {
                    logger.error('Error fetching commission payments by type:', error);
                    return customError("Failed to fetch commission payments", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async updateCommissionPayment(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { id } = request.params;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!id || isNaN(parseInt(id))) {
                    return customError("Valid payment ID is required", 400, response);
               }

               const updateData = request.body;

               delete updateData.id;
               delete updateData.created_at;

               try {
                    const result = await controller.repo.updateCommissionPayment(parseInt(id), updateData);

                    if (result === 0) {
                         return customError("Commission payment not found", 404, response);
                    }

                    // If amount_paid or commission_due was updated, check if status needs to change
                    if (updateData.amount_paid !== undefined || updateData.commission_due !== undefined) {
                         const updatedPayment = await controller.repo.getCommissionPaymentById(parseInt(id));
                         if (updatedPayment) {
                              const totalPaid = parseFloat(updatedPayment.total_amount_paid?.toString() || '0');
                              const commissionDue = parseFloat(updatedPayment.commission_due?.toString() || '0');
                              const newStatus = controller.determinePaymentStatus(totalPaid, commissionDue);
                              if (newStatus !== updatedPayment.status) {
                                   await controller.repo.updateCommissionPaymentStatus(parseInt(id), newStatus);
                              }
                         }
                    }

                    return response.send({
                         status: true,
                         message: "Commission payment updated successfully"
                    });
               } catch (error) {
                    logger.error('Error updating commission payment:', error);
                    return customError("Failed to update commission payment", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async updatePaymentAmount(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { id } = request.params;
               const { amount_paid, trackid, paymentmode, paid_by, notes } = request.body;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!id || isNaN(parseInt(id))) {
                    return customError("Valid payment ID is required", 400, response);
               }

               if (amount_paid === undefined || amount_paid === null || isNaN(parseFloat(amount_paid))) {
                    return customError("Valid amount_paid is required", 400, response);
               }

               try {
                    const result = await controller.repo.createCommissionPaymentTransaction({
                         commission_payment_id: parseInt(id),
                         amount_paid: parseFloat(amount_paid),
                         trackid,
                         paymentmode,
                         paid_by,
                         notes
                    });

                    return response.send({
                         status: true,
                         message: "Payment transaction added successfully",
                         data: { transactionId: result }
                    });
               } catch (error) {
                    logger.error('Error creating payment transaction:', error);
                    return customError("Failed to add payment transaction", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPaymentSummary(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { type } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (type && !['clinician', 'organization'].includes(type.toString())) {
                    return customError("Type must be either 'clinician' or 'organization'", 400, response);
               }

               try {
                    const summary = await controller.repo.getCommissionPaymentSummary(
                         type ? type.toString() as 'clinician' | 'organization' : undefined
                    );

                    return response.send({
                         status: true,
                         message: "Commission payment summary retrieved successfully",
                         data: summary
                    });
               } catch (error) {
                    logger.error('Error fetching commission payment summary:', error);
                    return customError("Failed to fetch commission payment summary", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getUnpaidCommissionPayments(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { type } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (type && !['clinician', 'organization'].includes(type.toString())) {
                    return customError("Type must be either 'clinician' or 'organization'", 400, response);
               }

               try {
                    const payments = await controller.repo.getUnpaidCommissionPayments(
                         type ? type.toString() as 'clinician' | 'organization' : undefined
                    );

                    return response.send({
                         status: true,
                         message: "Unpaid commission payments retrieved successfully",
                         data: payments
                    });
               } catch (error) {
                    logger.error('Error fetching unpaid commission payments:', error);
                    return customError("Failed to fetch unpaid commission payments", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPaymentsWithDetails(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { limit } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               try {
                    const payments = await controller.repo.getCommissionPaymentsWithServiceDetails(
                         limit ? parseInt(limit.toString()) : undefined
                    );

                    return response.send({
                         status: true,
                         message: "Commission payments with details retrieved successfully",
                         data: payments
                    });
               } catch (error) {
                    logger.error('Error fetching commission payments with details:', error);
                    return customError("Failed to fetch commission payments with details", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async deleteCommissionPayment(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { id } = request.params;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!id || isNaN(parseInt(id))) {
                    return customError("Valid payment ID is required", 400, response);
               }

               try {
                    const result = await controller.repo.deleteCommissionPayment(parseInt(id));

                    if (result === 0) {
                         return customError("Commission payment not found", 404, response);
                    }

                    return response.send({
                         status: true,
                         message: "Commission payment deleted successfully"
                    });
               } catch (error) {
                    logger.error('Error deleting commission payment:', error);
                    return customError("Failed to delete commission payment", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async updateCommissionPaymentStatus(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { id } = request.params;
               const { status } = request.body;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!id || isNaN(parseInt(id))) {
                    return customError("Valid payment ID is required", 400, response);
               }

               if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
                    return customError("Valid status is required (pending, paid, overdue, cancelled)", 400, response);
               }

               try {
                    const result = await controller.repo.updateCommissionPaymentStatus(parseInt(id), status);

                    if (result === 0) {
                         return customError("Commission payment not found", 404, response);
                    }

                    return response.send({
                         status: true,
                         message: "Commission payment status updated successfully"
                    });
               } catch (error) {
                    logger.error('Error updating commission payment status:', error);
                    return customError("Failed to update commission payment status", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPaymentTransactions(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { commissionPaymentId } = request.params;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!commissionPaymentId || isNaN(parseInt(commissionPaymentId))) {
                    return customError("Valid commission payment ID is required", 400, response);
               }

               try {
                    const transactions = await controller.repo.getCommissionPaymentTransactions(parseInt(commissionPaymentId));

                    return response.send({
                         status: true,
                         message: "Commission payment transactions retrieved successfully",
                         data: transactions
                    });
               } catch (error) {
                    logger.error('Error fetching commission payment transactions:', error);
                    return customError("Failed to fetch commission payment transactions", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async createCommissionPaymentTransaction(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               const {
                    commission_payment_id,
                    amount_paid,
                    trackid,
                    paymentmode,
                    paid_by,
                    notes
               } = request.body;

               if (!commission_payment_id || !amount_paid) {
                    return customError("commission_payment_id and amount_paid are required", 400, response);
               }

               try {
                    const transactionId = await controller.repo.createCommissionPaymentTransaction({
                         commission_payment_id,
                         amount_paid,
                         trackid,
                         paymentmode,
                         paid_by,
                         notes
                    });

                    return response.send({
                         status: true,
                         message: "Commission payment transaction created successfully",
                         data: { transactionId }
                    });
               } catch (error) {
                    logger.error('Error creating commission payment transaction:', error);
                    return customError("Failed to create commission payment transaction", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async deleteCommissionPaymentTransaction(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { id } = request.params;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!id || isNaN(parseInt(id))) {
                    return customError("Valid transaction ID is required", 400, response);
               }

               try {
                    const result = await controller.repo.deleteCommissionPaymentTransaction(parseInt(id));

                    if (result === 0) {
                         return customError("Commission payment transaction not found", 404, response);
                    }

                    return response.send({
                         status: true,
                         message: "Commission payment transaction deleted successfully"
                    });
               } catch (error) {
                    logger.error('Error deleting commission payment transaction:', error);
                    return customError("Failed to delete commission payment transaction", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }

     async getCommissionPaymentsByStatus(request: Request, response: Response) {
          async function validate() {
               const { tenantId } = request.query;
               const { status } = request.params;
               const { limit } = request.query;
               const tenantIdP = parseInt(tenantId.toString());

               const controller = new CommissionPaymentsController(tenantIdP);

               if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
                    return customError("Valid status is required (pending, paid, overdue, cancelled)", 400, response);
               }

               try {
                    const payments = await controller.repo.getCommissionPaymentsByStatus(status as 'pending' | 'paid' | 'overdue' | 'cancelled', limit ? parseInt(limit.toString()) : undefined);

                    return response.send({
                         status: true,
                         message: "Commission payments retrieved successfully",
                         data: payments
                    });
               } catch (error) {
                    logger.error('Error fetching commission payments by status:', error);
                    return customError("Failed to fetch commission payments by status", 500, response);
               }
          }
          wrapperTryCatch(validate, (err) => logger.error(err));
     }
}