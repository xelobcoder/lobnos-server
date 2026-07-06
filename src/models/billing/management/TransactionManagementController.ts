import { Request, Response } from "express";
import { TransactionManagementFactory } from "./TransactionManagementFactory";
import { responseError, handleOverLoad, customError } from "../../../hooks/helper";

export class TransactionManagementController {
    /**
     * Get absolute full transaction details with all joins and audit
     */
    static getFullTransactionDetails = handleOverLoad(async (req: Request, res: Response) => {
        try {
            const { billingid } = req.params;
            const { tenantId } = req.query;

            if (!billingid || !tenantId) {
                return customError("billingid and tenantId are required", 400, res);
            }

            const service = TransactionManagementFactory.createService(Number(tenantId));
            const details = await service.getFullTransactionDetails(Number(billingid));

            res.send({
                statusCode: 200,
                message: "Full transaction details retrieved successfully",
                result: details
            });
        } catch (err: any) {
            console.error("Error in getFullTransactionDetails:", err);
            if (err.message.includes("not found")) {
                return customError(err.message, 404, res);
            }
            responseError(res);
        }
    });

    /**
     * Get detailed audit history for a transaction
     */
    static getTransactionAuditHistory = handleOverLoad(async (req: Request, res: Response) => {
        try {
            const { billingid } = req.params;
            const { tenantId } = req.query;

            if (!billingid || !tenantId) {
                return customError("billingid and tenantId are required", 400, res);
            }

            const service = TransactionManagementFactory.createService(Number(tenantId));
            const history = await service.getTransactionAuditHistory(Number(billingid));

            res.send({
                statusCode: 200,
                message: "Transaction audit history retrieved successfully",
                result: history
            });
        } catch (err) {
            console.error("Error in getTransactionAuditHistory:", err);
            responseError(res);
        }
    });

    /**
     * Update payment history for a transaction
     */
    static updatePaymentHistory = handleOverLoad(async (req: Request, res: Response) => {
        try {
            const { tenantId } = req.query;
            const { KeyID, Amount, PaymentMode, Date: paymentDate, employeeid, reason } = req.body;

            if (!tenantId || !KeyID || !employeeid) {
                return customError("tenantId, KeyID, and employeeid are required", 400, res);
            }

            const service = TransactionManagementFactory.createService(Number(tenantId));
            const success = await service.updatePaymentHistory({
                KeyID: Number(KeyID),
                Amount: Amount !== undefined ? Number(Amount) : undefined,
                PaymentMode: PaymentMode !== undefined ? Number(PaymentMode) : undefined,
                Date: paymentDate,
                employeeid: Number(employeeid),
                reason
            });

            if (success) {
                res.send({
                    statusCode: 200,
                    message: "Payment history updated successfully"
                });
            } else {
                customError("Failed to update payment history", 500, res);
            }
        } catch (err) {
            console.error("Error in updatePaymentHistory:", err);
            responseError(res);
        }
    });

    /**
     * Edit transaction (billing and services)
     */
    static editTransaction = handleOverLoad(async (req: Request, res: Response) => {
        try {
            const { tenantId } = req.query;
            const { billingUpdate, serviceUpdates } = req.body;

            if (!tenantId || !billingUpdate) {
                return customError("tenantId and billingUpdate are required", 400, res);
            }

            const service = TransactionManagementFactory.createService(Number(tenantId));
            const success = await service.editTransaction(billingUpdate, serviceUpdates || []);

            if (success) {
                res.send({
                    statusCode: 200,
                    message: "Transaction edited successfully"
                });
            } else {
                customError("Failed to edit transaction", 500, res);
            }
        } catch (err) {
            console.error("Error in editTransaction:", err);
            responseError(res);
        }
    });

    /**
     * Void a transaction
     */
    static voidTransaction = handleOverLoad(async (req: Request, res: Response) => {
        try {
            const { billingid } = req.params;
            const { tenantId } = req.query;
            const { employeeid } = req.body;

            if (!billingid || !tenantId || !employeeid) return customError("billingid, tenantId, and employeeid are required", 400, res);
            const service = TransactionManagementFactory.createService(Number(tenantId));
            const success = await service.voidTransaction(Number(billingid), Number(employeeid));

            if (success) {
                res.send({
                    statusCode: 200,
                    status: true,
                    message: "Transaction voided successfully"
                });
            } else {
                res.send({
                    statusCode: 200,
                    status: false,
                    message: "Voiding transaction failed"
                })
            }
        } catch (err) {
            console.error("Error in voidTransaction:", err);
            responseError(res);
        }
    });
}
