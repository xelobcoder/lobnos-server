import { getAuthUser } from "../../middleware/authority";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";
import KnexConnection from "../../database/KnexConnections";
import { Request, response, Response } from "express";
import ResultPrint from "../../models/result/resultPrint";
import { getBillingInvoiceData } from "../../models/invoice/invoice";
import Payment from "../../models/payments/payments";
import { OperationsFailures } from "../../models/operations/types";
import { responseError, customError } from "../../hooks/helper";

const payment = new Payment(0);

export const getResultReady = async (req: Request<{}, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await new ResultPrint(0).get_printables(tenantId, req.query as any);
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const getAdvancedTablesSearch = async (req: Request<{}, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await new ResultPrint(0).advancedTablesSearch(tenantId, req.query as any);
          res.send({ status: "success", statusCode: 200, result });
     } catch (err) {
          responseError(res);
     }
};

export const getResultById = async (req: Request<{ id: string }, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const billingid = parseInt(req.params.id.slice(1));
          if (!billingid) return customError("billingid not provided", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await new ResultPrint(0).get_extrainfo_test(tenantId, billingid);
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const updatePrintCount = async (
     req: Request<{}, {}, { id: number; count: number }, { tenantId: string }>,
     res: Response,
) => {
     try {
          const { id, count } = req.body;
          if (!id || !count) return customError("test ascension id and count of print required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await new ResultPrint(0).updatePrintCount(tenantId, id, count);
          res.send({ status: result === true ? "success" : "failed" });
     } catch (err) {
          responseError(res);
     }
};

export const getSummaryReadyPage = async (req: Request<{}, {}, {}, { tenantId: number }>, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await new ResultPrint(0).get_summary_ready_page(tenantId, req.query as any);
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const getClientTransactionInfo = async (req: Request<{}, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const { tenantId } = req.query;
          const result = await payment.getClientTransactionInformation(parseInt(tenantId), req.query as any);
          res.send({ ...result, statusCode: 200, status: "success" });
     } catch (err: any) {
          customError(err?.message || "Unable to load client transactions", Number(err?.statusCode) || 500, res);
     }
};

export const getClientBulkOutstanding = async (
     req: Request<{}, {}, {}, { tenantId: string; patientid: number }>,
     res: Response,
) => {
     const { patientid } = req.query;
     if (!patientid) {
          customError("patientid required", 404, res);
     } else {
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await payment.allClientDebtTransactions(tenantId, parseInt(patientid.toString()));
          res.send({ result, statusCode: 200, status: "success" });
     }
};

export const getPaymentModes = (req: Request, res: Response) => {
     payment.paymentMode(req, res);
};

export const getClientTransactionHistory = (req: Request, res: Response) => {
     payment.specificBillTransactionHx(req, res);
};

export const updatePayment = (req: Request, res: Response) => {
     payment.updatePayment(req, res);
};

export const previewReport = async (
     request: Request<{}, {}, {}, { tenantId: string; testid: number; billingid: number }>,
     response: Response,
) => {
     try {
          const { testid, billingid } = request.query;
          if (!testid || !billingid) {
               return customError(
                    OperationsFailures.invalidResquestQuery + " required query params missing",
                    400,
                    response,
               );
          }
          const parsedBillingid = parseInt(billingid.toString());
          const parsedTestId = parseInt(testid.toString());
          const tenantId = parseInt(request.query.tenantId.toString());
          const result = await new ResultPrint(0).previewReport(tenantId, parsedBillingid, parsedTestId);

          response.send({ result });
     } catch (err) {
          responseError(response);
     }
};

export const getPreviewComments = (req: Request, res: Response) => {
     const { billingid, testid } = req.query;
     if (billingid) {
          const billid: number = parseInt(billingid as string);
          new ResultPrint(billid).getComments(billingid as any, parseInt(testid as string), res as any);
     } else {
          res.send({ status: "error", statusCode: 401, message: "Include Billingid" });
     }
};

export const getResultEntryScientist = async (
     req: Request<{}, {}, {}, { tenantId: number; testid: number; billingid: number; ascensionid: number }>,
     res: Response,
) => {
     try {
          const { testid, billingid, ascensionid } = req.query;
          if (!billingid || !testid || !ascensionid) {
               return customError(
                    OperationsFailures.invalidResquestQuery + "billingid or testid not included in the query",
                    404,
                    res,
               );
          }
          const parsedBillingid = parseInt(billingid.toString());
          const parsedTestId = parseInt(testid.toString());
          const ascensionId = parseInt(ascensionid.toString());
          const tenantId = parseInt(req.query.tenantId.toString());

          const result = await new ResultPrint(parsedBillingid).getResultEntryScientist(
               tenantId,
               parsedBillingid,
               parsedTestId,
               ascensionId,
          );
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const checkApproval = async (
     req: Request<{}, {}, { billingid: number; testid: number }, { tenantId: number }>,
     res: Response,
) => {
     const { billingid, testid } = req.body;
     if (billingid && testid) {
          const tenantId = parseInt(req.query.tenantId.toString());
          const approved = await new ResultPrint(billingid).checkApproval(tenantId, billingid, testid);
          res.send({ approved });
     } else {
          res.status(401).json({ status: "error", message: "include testid and billing in request body" });
     }
};

export const makeDecisionOnResult = async (
     req: Request<{}, {}, Parameters<ResultPrint["makeDecisionOnResult"]>[1], { tenantId: string }>,
     res: Response,
) => {
     try {
          const actor = getAuthUser(req);
          if (!actor) return customError("Authentication required", 401, res);
          if (Number(req.query.tenantId) !== actor.tenantId)
               return customError("Organization scope does not match the session", 403, res);
          if (!(await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid)))
               return customError("You do not have permission to validate results", 403, res);
          const billingid = Number(req.body?.billingid),
               testid = Number(req.body?.testid);
          if (![billingid, testid].every((id) => Number.isSafeInteger(id) && id > 0))
               return customError("Valid billing and test IDs are required", 400, res);
          const db = await KnexConnection(actor.tenantId);
          const bill = await db("billing").where({ billingid }).first("branchid");
          if (!bill || (actor.branch != null && Number(bill.branchid) !== Number(actor.branch)))
               return customError("Ordered test not found in your branch", 404, res);
          const result = await new ResultPrint(0).makeDecisionOnResult(actor.tenantId, {
               ...req.body,
               billingid,
               testid,
               approvedby: String(actor.employeeid),
          });
          return res.send({
               status: result ? "success" : "error",
               statusCode: result ? 200 : 409,
               message: result ? "update successful" : "error updating data",
          });
     } catch (err: any) {
          if (err?.statusCode) return customError(err.message, err.statusCode, res);
          responseError(res, err);
     }
};

export const getBillingInvoice = async (
     req: Request<{}, {}, {}, { tenantId: string; billingid: string }>,
     response: Response,
) => {
     try {
          const { billingid } = req.query;
          const tenantId = parseInt(req.query.tenantId.toString());
          const data = await getBillingInvoiceData(tenantId, parseInt(billingid.toString()));
          response.send(data);
     } catch (err) {
          response.send([]);
     }
};

// export const emailBillingReceipt = async (req: Request, res: Response) => {
//   const { billingid } = req.query;
//   if (billingid) {
//     await new EmailService().forwardBillingReceipt(billingid);
//   } else {
//     customError("billing id required", 404, res);
//   }
// };

export const getTransactionApprovedTest = async (
     req: Request<{}, {}, {}, { tenantId: string; billingid: string }>,
     res: Response,
) => {
     try {
          const { billingid } = req.query;
          const parsedBillingid = parseInt(billingid.toString());
          const tenantId = parseInt(req.query.tenantId.toString());
          const result = await new ResultPrint(parsedBillingid).getTransactionApprovedTest(tenantId, parsedBillingid);
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const getBillingReceipt = async (
     req: Request<{}, {}, {}, { tenantId: string; billingid: string }>,
     res: Response,
) => {
     const { billingid } = req.query;
     if (!billingid) {
          customError("billingid not provided", 404, res);
     }
};
