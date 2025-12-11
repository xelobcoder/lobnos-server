import { Request, Response } from "express";
import MultiPayment from "../../models/payments/multi-payment";



export const processMultiServicePayment = async (req: Request, res: Response): Promise<void> => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { service_payments, total_amount, description, employeeid } = req.body;

          if (isNaN(tenantId) || !service_payments || !Array.isArray(service_payments) || service_payments.length === 0) {
               res.status(400).json({ error: 'Invalid tenantId or service_payments data' });
               return;
          }

          const paymentData = {
               service_payments,
               total_amount,
               description: description || '',
               employeeid,
               tenantId
          };

          const paymentsMulti = new MultiPayment(tenantId);
          const result = await paymentsMulti.processPayment(paymentData);

          if (result.success) {
               res.status(200).json(result);
          } else {
               res.status(400).json(result);
          }
     } catch (error) {
          console.error('Error processing multi-service payment:', error);
          res.status(500).json({ error: 'Internal server error' });
     }
};

export const getPatientOutstandingPayments = async (req: Request, res: Response): Promise<void> => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const patientId = parseInt(req.query.patientid as string);
          const status = req.query.status as "completed" | "all" | "pending" || "all";

          if (isNaN(patientId)) {
               res.status(400).json({ error: 'Invalid tenantId or patientId' });
               return;
          }
          const paymentsMulti = await new MultiPayment(tenantId).getOutstandingPayments(patientId, status);
          res.status(200).json({ success: true, data: paymentsMulti });
     } catch (error) {
          console.error('Error fetching outstanding payments:', error);
          res.status(500).json({ error: 'Internal server error' });
     }
};