// src/appHandlers.ts

import { Request, Response } from "express";
import { customError, rowAffected, responseError } from "../../../helper";
import ApplicationSettings from "../../models/application/settings";
import Tax from "../../models/application/tax";
import ResultSettings from "../../models/application/results";
import logger from "../../../logger";

const appsettings = new ApplicationSettings();
const tax = new Tax();
const result = new ResultSettings();

export const getApplicationSettings = (req: Request, res: Response) => {
  appsettings.getApplicationSettings(req, res);
};

export const getApplicationSettingsBilling = (req: Request, res: Response) => {
  appsettings.getApplicationSettingsBilling(req, res);
};

export const updateApplicationSettings = (req: Request, res: Response) => {
  appsettings.updateApplicationSettings(req, res);
};

export const updateSmsSettings = (req: Request, res: Response) => {
  appsettings.updateSmsSettings(req, res);
};

export const getSmsSettings = (req: Request, res: Response) => {
  appsettings.getSmsSettings(req, res);
};

export const getEmailPreference = async (req: Request, res: Response) => {
  try {
    const result = await appsettings.getEmailPreference();
    res.send({ message: "success", status: "success", statusCode: 200, result });
  } catch (err) {
    customError("something went wrong", 500, res);
  }
};

export const getGeneralEmailSettings = async (req: Request, res: Response) => {
  try {
    const result = await appsettings.getGeneralEmailSettings();
    res.send({ message: "success", status: "success", statusCode: 200, result });
  } catch (err) {
    customError("something went wrong", 500, res);
  }
};

export const updateGeneralEmailSettings = async (req: Request, res: Response) => {
  try {
    const result = await appsettings.updateGeneralEmailSettings(req.body);
    res.send({
      message: rowAffected(result) ? "updated successfully" : "No updates effected",
      status: "success",
      statusCode: 200,
    });
  } catch (err) {
    customError("something went wrong", 500, res);
  }
};

export const updateEmailPreference = (req: Request, res: Response) => {
  appsettings.updateEmailPreference(req, res);
};

export const updateRegistrationFields = async (req: Request, res: Response) => {
  try {
    const result = await appsettings.updateRegistrationFields(req, res);
    if (result === true) {
      res.send({ message: "fields updated successfully", statusCode: 200, status: "success" });
    } else {
      res.send({ message: "fields update failed", statusCode: "error", status: "error" });
    }
  } catch (err) {
    logger.error(err);
    responseError(res);
  }
};

export const getRegistrationSettings = async (req: Request, res: Response) => {
  try {
    let result = await appsettings.getRegistrationSettings();
    if (result.length > 0) {
      result = result[0]["fields"];
      if (result !== "{}") {
        return res.send(result);
      }
      res.send(result);
    } else {
      return res.send({});
    }
  } catch (err) {
    responseError(res);
  }
};

export const addTax = (req: Request, res: Response) => {
  tax.addTax(req, res);
};

export const getTax = (req: Request, res: Response) => {
  tax.getTax(req, res);
};

export const updateTax = (req: Request, res: Response) => {
  tax.updateTax(req, res);
};

export const changeTaxStatus = (req: Request, res: Response) => {
  tax.changeTaxStatus(req, res);
};

export const deleteTax = (req: Request, res: Response) => {
  tax.deleteTax(req, res);
};

export const getResultSettings = (req: Request, res: Response) => {
  result.getResultSettings(req, res);
};

export const updateResultSettings = (req: Request, res: Response) => {
  result.updateResultSettings(req, res);
};
