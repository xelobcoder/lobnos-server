import { Request, Response } from "express";
import connection from "./db";
import logger from "../../../logger";
import { convertKeysToLowerCase, promisifyQuery, customError, rowAffected, paginationQuery } from "../../../helper";
import SQLQueries from "./queries"; // Import SQLQueries from the separate file

class ClinicianController {
  public async getClinicians(req: Request, res: Response): Promise<void> {
    try {
      const { count: number, page: number } = req.query;
      if (count > 0 && page >= 0) {
        let result = await paginationQuery({ page: number, count: number }, SQLQueries.getCliniciansWithPagination);
        result = result.length > 0 ? result.map((item: number) => convertKeysToLowerCase(item)) : result;
        res.send({ statusCode: 200, status: "success", result });
      } else {
        let result = await promisifyQuery(SQLQueries.getAllClinicians);
        result = result.length > 0 ? result.map((item) => convertKeysToLowerCase(item)) : result;
        res.send({ statusCode: 200, status: "success", result });
      }
    } catch (err) {
      logger.error(err);
    }
  }

  public async putCliniciansBasic(req: Request, res: Response): Promise<void> {
    const { name, phone, email, location, address, occupation, id } = req.body;

    if (!id) {
      customError("Clinician id not added", 404, res);
      return;
    }

    if (!(await this.isClinicianExist(email, phone))) {
      customError("Clinician not found", 200, res);
      return;
    }

    const values = [name, phone, email, location, address, occupation, id];

    try {
      const isUpdated = await promisifyQuery(SQLQueries.updateClinicianBasicInfo, values);

      if (rowAffected(isUpdated)) {
        res.send({
          statusCode: 200,
          message: "Clinician updated successfully",
          status: "success",
        });
      } else {
        res.send({
          statusCode: 401,
          message: "Clinician not updated",
        });
      }
    } catch (err) {
      logger.error(err);
      customError("Error updating clinician", 500, res);
    }
  }

  public async deleteClinicians(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.body;
      if (!id) {
        return customError("id required", 404, res);
      }
      const result = rowAffected(await promisifyQuery(SQLQueries.deleteClinicianById, [parseInt(id)]));
      if (result) {
        res.send({
          statusCode: 200,
          status: "success",
          message: "Deleted successfully",
        });
      } else {
        res.send({
          statusCode: 500,
          status: "error",
          message: "Something went wrong. Wrong ID provided",
        });
      }
    } catch (err) {
      logger.error(err);
      customError("Error deleting clinician record", 500, res);
    }
  }

  private async isClinicianExist(email: string, mobile: string): Promise<boolean> {
    if (!email || !mobile) return false;
    const matched = await promisifyQuery(`SELECT * FROM clinicianbasicinfo WHERE EMAIL = ? OR phone = ?`, [email, mobile]);
    return matched.length > 0 ? true : false;
  }

  public async postClinicianBasicInfo(req: Request, res: Response): Promise<string | number> {
    const { id, name, phone, email, location, address, occupation, organization } = req.body;

    if (!phone || !email) return "Phone number and email required";

    const isValidNumber = (number: string): boolean => {
      return number.length === 10 && (number.startsWith("0") || number.startsWith("0"));
    };

    if (!isValidNumber(phone) || !email.includes("@")) return "Valid phone number and email required";

    if (await this.isClinicianExist(email, phone)) return "Email or phone number is already registered with a clinician";

    const values = [name, phone, email, location, address, occupation, organization];

    try {
      const result = await promisifyQuery(SQLQueries.insertClinicianBasicInfo, values);
      const { insertId } = result;

      if (insertId !== 0) {
        const random = require("crypto").randomBytes(5).toString("hex");
        const tempCredentials = `UPDATE clinicianscredentials SET password  = ?`;
        await promisifyQuery(tempCredentials, [random]);
        return insertId;
      }
      return "Adding new clinician failed";
    } catch (err) {
      logger.error(err);
      return "Error adding new clinician";
    }
  }

  public getSingleClinician(req: Request, res: Response): void {
    const { id } = req.query;
    const query = SQLQueries.getSingleClinicianById;
    connection.query(query, [id], (err, result) => {
      if (err) {
        logger.error(err);
        res.send({
          statusCode: 500,
          status: "error",
          message: "Error fetching clinician data",
        });
      } else {
        res.send({
          statusCode: 200,
          result,
          status: "success",
        });
      }
    });
  }

  public async getTopPerformingClinicians(req: Request, res: Response): Promise<void> {
    const { count } = req.query;

    if (!count) {
      res.send({
        message: "Count representing top count required",
        statusCode: 401,
        status: "warning",
      });
      return;
    }

    try {
      const result = await promisifyQuery(SQLQueries.getTopPerformingClinicians, [count]);
      res.send({
        result,
        statusCode: 200,
        status: "success",
      });
    } catch (err) {
      logger.error(err);
      res.send({
        message: "Error retrieving top performing clinicians",
        statusCode: 500,
        status: "error",
      });
    }
  }

  public async getClinicianResult(clinicianid: number, startdate?: string, enddate?: string): Promise<any[]> {
    try {
      let values: (string | number)[] = [clinicianid];
      let query = SQLQueries.getClinicianResult;

      if (startdate && enddate) {
        query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
        values.push(startdate);
        values.push(enddate);
      } else {
        query += ` AND DATE(b.billedon) = DATE(CURRENT_DATE) ORDER BY b.billedon DESC`;
      }

      const result = await promisifyQuery(query, values);
      return result;
    } catch (error) {
      logger.error(error);
      return [];
    }
  }

  public async getBillingTestBasedByClinician(billingid: number, clinicianid: number): Promise<any[]> {
    const query = SQLQueries.getBillingTestBasedByClinician;
    const result = await promisifyQuery(query, [clinicianid, billingid]);
    return result;
  }
}

export default new ClinicianController();
