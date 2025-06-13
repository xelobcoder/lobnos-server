import { promisifyQuery, customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { getRoleQuery, getReadyForApprovalsQuery, insertApprovalQuery } from "./queries";

class Manager implements IManager {
  employeeid: number;
  billingid: number;
  testid: number;

  constructor(employeeid: number, billingid: number, testid: number) {
    this.employeeid = employeeid;
    this.billingid = billingid;
    this.testid = testid;
  }

  getManagerApprovals(tenantId: number, duration: string): void {
    let defaultDuration: string = "daily";
  }

  async verificationManager(tenantId: number): Promise<boolean> {
    try {
      const result = await promisifyQuery(tenantId, getRoleQuery, [this.employeeid]);
      return result.length > 0 && result[0]["role"].toLowerCase() === "manager";
    } catch (err) {
      logger.error(err?.message);
      throw new Error(err);
    }
  }

  async insertApproval(tenantId: number, approvalStatus: boolean, message: string | null = null): Promise<any> {
    try {
      let query = insertApprovalQuery;
      const values = [approvalStatus, this.employeeid, message, this.billingid, this.testid];
      return promisifyQuery(tenantId, query, values);
    } catch (err) {
      logger.error(err?.message || message);
      throw new Error(err);
    }
  }

  async getReadyForApprovals(tenantId: number, request: any, response: any): Promise<void> {
    try {
      let query = getReadyForApprovalsQuery;
      let result = await promisifyQuery(tenantId, query);
      if (result.length > 0) {
        result = result.sort((a: any, b: any) => a.urgency - b.urgency);
        response.send(result);
      } else {
        response.send(result);
      }
    } catch (err) {
      logger.error(err.message);
      customError(err?.message, 500, response);
    }
  }
}

export default Manager;
