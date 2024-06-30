// src/handlers.ts

import { Request, Response } from "express";
import { customError, responseError } from "../../helper";
import ResultPrint from "../models/ResultPrint";
import EmailService from "../EmailServices/EmailCore";
import { getBillingInvoiceData } from "../models/invoice";
import Payment from "../models/payment";
import logger from "../../logger";
import PDFGENERATION from "../models/pdfGeneration";

const payment = new Payment();

export const getResultReady = async (req: Request, res: Response) => {
  new ResultPrint().get_printables(req, res);
};

export const getAdvancedTablesSearch = (req: Request, res: Response) => {
  new ResultPrint().advancedTablesSearch(req, res);
};

export const getResultById = async (req: Request, res: Response) => {
  const billingid = parseInt(req.params.id.slice(1));
  if (!billingid) return customError("billingid not provided", 404, res);
  await new ResultPrint().get_extrainfo_test(billingid, res);
};

export const updatePrintCount = async (req: Request, res: Response) => {
  try {
    const { id, count } = req.body;
    if (!id || !count) return customError("test ascension id and count of print required", 404, res);
    const result = await new ResultPrint().updatePrintCount(id, count);
    res.send({ status: result === true ? "success" : "failed" });
  } catch (err) {
    logger.error(err);
    responseError(res);
  }
};

export const getSummaryReadyPage = (req: Request, res: Response) => {
  new ResultPrint().get_summary_ready_page(req, res);
};

export const getClientTransactionInfo = async (req: Request, res: Response) => {
  try {
    const result = await payment.getClientTransactionInformation(req.query, res);
    res.send({ result, statusCode: 200, status: "success" });
  } catch (err) {
    customError(err?.message, 500, res);
  }
};

export const getClientBulkOutstanding = async (req: Request, res: Response) => {
  const { patientid } = req.query;
  if (!patientid) {
    customError("patientid required", 404, res);
  } else {
    const result = await payment.allClientDebtTransactions(patientid as string);
    res.send({ result, statusCode: 200, status: "success" });
  }
};

export const clearClientOutstandingDebt = async (req: Request, res: Response) => {
  try {
    const { patientid, paymentmode, amountpaid, employeeid } = req.body;
    if (!patientid || !paymentmode || !amountpaid || !employeeid) {
      return customError("include amountpaid, paymentmode, employeeid and patientid in request body", 404, res);
    }
    const result = await payment.clearClientDebtBulk(patientid, amountpaid, paymentmode, employeeid);
    if (result === true) {
      res.send({ message: "updated successfully", status: "success", statusCode: "200" });
    } else if (result === "No Exist") {
      res.send({ message: "No debt available to clear", status: "error", statusCode: "500" });
    } else {
      res.send({ message: "updated failed", status: "failed", statusCode: "500" });
    }
  } catch (err) {
    responseError(res);
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

export const previewReport = (req: Request, res: Response) => {
  try {
    new ResultPrint().previewReport(req, res);
  } catch (err) {
    logger.error(err);
  }
};

export const getPreviewComments = (req: Request, res: Response) => {
  const { billingid, testid } = req.query;
  if (billingid) {
    new ResultPrint().getComments(billingid as string, testid as string, res);
  } else {
    res.send({ status: "error", statusCode: 401, message: "Include Billingid" });
  }
};

export const getResultEntryScientist = async (req: Request, res: Response) => {
  const { testid, billingid } = req.query;
  if (!billingid || !testid) {
    return customError("billingid or testid not included in the query", 404, res);
  }
  const result = await new ResultPrint().getResultEntryScientist(billingid as string, testid as string);
  res.send(result);
};

export const checkApproval = (req: Request, res: Response) => {
  const { billingid, testid } = req.body;
  if (billingid && testid) {
    new ResultPrint().checkApproval(billingid, testid, res);
  } else {
    res.status(401).json({ status: "error", message: "include testid and billing in request body" });
  }
};

export const makeDecisionOnResult = (req: Request, res: Response) => {
  new ResultPrint().makeDecisionOnResult(req, res);
};

export const getBillingInvoice = (req: Request, res: Response) => {
  const { billingid } = req.query;
  getBillingInvoiceData(billingid as string, res);
};

export const emailBillingReceipt = async (req: Request, res: Response) => {
  const { billingid } = req.query;
  if (billingid) {
    await new EmailService().forwardBillingReceipt(billingid as string);
  } else {
    customError("billing id required", 404, res);
  }
};

export const generatePDFResult = async (req: Request, res: Response) => {
  const { billingid, testname, testid } = req.query;
  try {
    if (billingid && testname && testid) {
      try {
        const pdfgenerate = new PDFGENERATION(billingid as string, testid as string, testname as string);
        await pdfgenerate.generatePDFResult(res);
      } catch (error) {
        customError("error fetching data", 500, res);
      }
    } else {
      customError("include billingid, testname and testid", 404, res);
    }
  } catch (err) {
    console.log(err);
  }
};

export const getTransactionApprovedTest = async (req: Request, res: Response) => {
  try {
    const { billingid } = req.query;
    const result = await new ResultPrint().getTransactionApprovedTest(billingid as string);
    res.send(result);
  } catch (err) {
    responseError(res);
  }
};

export const getBillingReceipt = async (req: Request, res: Response) => {
  const { billingid } = req.query;
  if (!billingid) {
    customError("billingid not provided", 404, res);
  }
};
