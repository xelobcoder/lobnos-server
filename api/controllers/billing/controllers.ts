import { customError } from "../../../helper";
import { Billing } from "../../models/billing/billing";
import { Request, Response } from "express";
import { billErrors } from "../../models/billing/billingclientTypes";
import { wrapperTryCatch } from "../../models/generics/trycatch";

export async function handleNewBilling(request: Request, response: Response) {
  async function validate() {
    const { patientid } = request.body;
    const bill = await new Billing(patientid).insertionProcess(request.body, false);
    if (typeof bill == "string" && bill == billErrors.already) {
      return response.send({ message: bill, statusCode: 200, status: "success" });
    } else if (typeof bill == "boolean" && bill) {
      return response.status(200).json({
        message: "billing successfully",
        statusCode: 200,
        status: "success",
      });
    } else {
      return customError(billErrors.error, 400, response);
    }
  }
  wrapperTryCatch(validate);
}
