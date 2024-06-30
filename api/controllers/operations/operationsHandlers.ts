import { Request, Response } from "express";
import { customError, rowAffected } from "../../helper";
import Operations from "../models/operations";

export const getAllCollections = async (req: Request, res: Response) => {
  const collections = new Operations();
  const result = await collections.getAllReadyTest(req);
  res.send({ statusCode: 200, message: "success", result });
};

export const getBillingTest = async (req: Request, res: Response) => {
  const { billingid } = req.query;

  if (!billingid) {
    res.status(400).send({
      statusCode: 400,
      message: "Invalid billingid",
    });
    return;
  }

  const result = await new Operations(billingid as string).billingTest(req);

  if (result === "Billingid is not ready for testing") {
    res.status(400).send({
      statusCode: 400,
      message: result,
    });
  } else {
    res.send({
      statusCode: 200,
      message: "success",
      result,
    });
  }
};

export const initiateProcessing = async (req: Request, res: Response) => {
  const { billingid, testid } = req.query;

  if (!billingid || !testid) {
    customError("billing id or testid is missing", 404, res);
    return;
  }

  const updatesProcessing = new Operations(billingid as string);
  const result = await updatesProcessing.initiateStart(testid as string, billingid as string);
  res.send({ status: rowAffected(result) ? "success" : "failed" });
};

export const getAllEnterResult = async (req: Request, res: Response) => {
  await new Operations().getAllEnterResult(req, res);
};

export const getAllTestPreview = async (req: Request, res: Response) => {
  await new Operations().getAllTestPreview(req, res);
};

export const getAllPendingCases = async (req: Request, res: Response) => {
  const { count = 10, page = 1, departmentid, status, testid } = req.query;
  await new Operations().getAllPendingCases(
    count as number,
    page as number,
    departmentid as string,
    status as string,
    testid as string,
    res
  );
};

export const getUltrasoundWaitingList = async (req: Request, res: Response) => {
  await new Operations().getUltrasoundWaitingList(req, res);
};

export const getProcessedScanList = async (req: Request, res: Response) => {
  await new Operations().processedScanList(req, res);
};
