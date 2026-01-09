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


export const generateTransactionReceiptHandler = async (req: Request, res: Response) => {
     try {
          const { billingid, employeeid } = req.query;
          const tenantId = parseInt(req.query.tenantId as string);

          if (!billingid || !employeeid || !tenantId) {
               return res.status(400).json({ status: 'error', message: 'Missing required parameters: billingid, employeeid, tenantId' });
          }

          const multiPayment = new MultiPayment(tenantId);
          const receipt = await multiPayment.generateTransactionReceipt(parseInt(billingid as string), parseInt(employeeid as string));

          res.status(200).json({ status: 'success', data: receipt });
     } catch (error) {
          console.error('Error generating transaction receipt:', error);
          res.status(500).json({ status: 'error', message: error.message });
     }
};

export const updateReceiptPrintedHandler = async (req: Request, res: Response) => {
     try {
          const { receiptId, employeeid, printed_at } = req.body;
          const tenantId = parseInt(req.query.tenantId as string);

          if (!receiptId || !employeeid) {
               return res.status(400).json({ status: 'error', message: 'Missing required parameters: receiptId, tenantId' });
          }

          const multiPayment = new MultiPayment(tenantId);
          await multiPayment.updateReceiptPrinted(parseInt(receiptId as string), employeeid, printed_at);

          res.status(200).json({ status: 'success', message: 'Receipt printed status updated' });
     } catch (error) {
          console.error('Error updating receipt printed status:', error);
          res.status(500).json({ status: 'error', message: error.message });
     }
};
export const getReceiptsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const page = parseInt(req.query.page as string) || 1;
          const count = parseInt(req.query.count as string) || 10;
          const sortby = (req.query.sortBy as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

          if (!tenantId) {
               return res.status(400).json({ status: 'error', message: 'Missing required parameter: tenantId' });
          }

          const multiPayment = new MultiPayment(tenantId);
          const result = await multiPayment.getReceipts(page, count, sortby);

          res.status(200).json({ status: 'success', data: result });
     } catch (error) {
          console.error('Error fetching receipts:', error);
          res.status(500).json({ status: 'error', message: error.message });
     }
};