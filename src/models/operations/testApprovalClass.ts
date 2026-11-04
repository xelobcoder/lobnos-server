import { ResultApprovalService } from "./ResultApprovalService";
import {
     q_insert_result_printing_tracking,
     q_get_result_printing_tracking_by_id,
     q_get_result_printing_tracking_by_ascensionid,
     q_update_result_printing_tracking,
     q_delete_result_printing_tracking,
} from "./OperationsQueries/resultPrintingTrackingQueries";

import Operations from "./operations";
import {
     q_get_print_count_for_test,
     q_get_result_approval_details,
     q_updateTestApprovalStatus,
} from "./OperationsQueries/testApprovalQueries";
import User from "../../LobnosAuth/user";
import { OperationsFailures, validatorsFinalFormatType } from "./types";
import ResultSettings from "../application/appsettings/result-settings/resultSettings";
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import RolesRepository from "../settings/users/RolesRepository";
import ApplicationSettings from "../application/appsettings/appset";
import KnexConnection from "../../database/KnexConnections";
import ImagingResultAuditRepository from "./imaging/ImagingResultAuditRepository";

interface dbotestresultapproval {
     id?: number;
     approvedBy: string;
     isapproved: number;
     printCount: number;
     approval_revision?: number;
     requires_revalidation?: number;
     lastupdatedon: Date | string;
}

export class TestApprovalClass extends Operations {
     private ascensionid: number;
     constructor(ascensionid: number) {
          super(null);
          this.ascensionid = ascensionid;
     }

     public static async updateTestApprovalStatus(
          ascensionid: number,
          approvedBy: number,
          tenantId: number,
          branchid?: number | null,
          expectedRevision?: number,
     ): Promise<boolean | string> {
          return new ResultApprovalService(tenantId).approve(ascensionid, approvedBy, branchid, expectedRevision);
     }

     public static async getAscensionPrintCount(ascensionid: number, tenantId: number): Promise<boolean | number> {
          let count = await promisifyQuery(tenantId, q_get_print_count_for_test, [ascensionid]);
          if (count.length == 0) return false;
          count = count[0]["printCount"];
          return count;
     }

     async getAscensionApprovedDetail(tenantId: number): Promise<dbotestresultapproval | null> {
          const rows = await promisifyQuery(tenantId, q_get_result_approval_details, [this.ascensionid]);
          return rows.length > 0 ? rows[0] : null;
     }

     async getAscensionApprovedList(tenantId: number): Promise<[] | number[] | number> {
          let approvedIndividualsPacket = await this.getAscensionApprovedDetail(tenantId);

          if (approvedIndividualsPacket === null) return [];
          let approvedIndividuals: string = approvedIndividualsPacket.approvedBy;

          if (typeof approvedIndividuals === "string" && approvedIndividuals.includes(",")) {
               let approvedIndividualsList = approvedIndividuals.split(",");
               if (approvedIndividualsList.length > 0) {
                    let approvedIndividualsListCont: number[] = approvedIndividualsList.map(
                         (item: string, index: number) => parseInt(item.toString()),
                    );
                    return approvedIndividualsListCont;
               }
               return [];
          }

          if (
               typeof approvedIndividuals == "string" &&
               approvedIndividuals.includes(",") == false &&
               !isNaN(parseInt(approvedIndividuals.toString()))
          ) {
               return parseInt(approvedIndividuals.toString());
          }

          if (approvedIndividuals === null) return [];
     }

     async getAscensionAprovedListDetails(tenantId: number): Promise<validatorsFinalFormatType[] | []> {
          try {
               let approvedList = await this.getAscensionApprovedList(tenantId);

               async function getUser(employeeId: number): Promise<null | validatorsFinalFormatType> {
                    const EmployeeRepo = await new RolesRepository(tenantId).getRoleById(employeeId);
                    return EmployeeRepo
                         ? { username: EmployeeRepo["username"], employeeid: employeeId, role: EmployeeRepo["role"] }
                         : null;
               }

               if (typeof approvedList === "number") {
                    return [await getUser(approvedList)];
               }

               if (approvedList.length === 0) return [];

               return Promise.all(
                    approvedList.map(async (employeeId: number, index: number) => {
                         return await getUser(employeeId);
                    }),
               );
          } catch (err) {
               console.log(err);
          }
     }

     public static async addAprovalItem(tenantId: number, ascensionId: number, transaction: any) {
          const queryRunner = transaction || (await KnexConnection(tenantId));
          const query = `INSERT INTO dbotestresultapproval (ascensionid,minvalidation,maxvalidation) VALUES (?,?,?)`;
          const resultsettings = await ResultSettings.getResultEntrySettings(tenantId);
          const minvalidation = resultsettings["minimumResultValidation"] || 1;
          const maxvalidation = resultsettings["maximumResultValidation"] || 10;
          return await queryRunner.raw(query, [ascensionId, minvalidation, maxvalidation]);
     }

     public static async updatePrintCount(tenantId: number, ascensionid: number, employeeId: number): Promise<boolean> {
          const result = await promisifyQuery(tenantId, q_updateTestApprovalStatus, [1, employeeId, ascensionid]);
          return rowAffected(result);
     }

     public static async getTransactionAscensionsApprovalStatus(tenantId: number, billingid: number): Promise<any[]> {
          const conn = await KnexConnection(tenantId);
          return await conn("test_ascension as ta")
               .leftJoin("dbotestresultapproval as dta", "ta.id", "dta.ascensionid")
               .innerJoin("test_panels as tp", "tp.id", "ta.testid")
               .select("tp.*", "ta.*", "ta.id as ascensionid", "dta.isapproved", "dta.requires_revalidation")
               .where("ta.billingid", billingid);
     }

     static async addResultPrintingTracking(
          tenantId: number,
          ascensionid: number,
          employeeid: number,
          action: "view" | "printed",
          actionon: Date | string,
     ) {
          return await promisifyQuery(tenantId, q_insert_result_printing_tracking, [
               ascensionid,
               employeeid,
               action,
               actionon,
          ]);
     }

     static async getResultPrintingTrackingById(tenantId: number, trackid: number) {
          const rows = await promisifyQuery(tenantId, q_get_result_printing_tracking_by_id, [trackid]);
          return rows.length > 0 ? rows[0] : null;
     }

     static async getResultPrintingTrackingByAscensionId(tenantId: number, ascensionid: number) {
          return await promisifyQuery(tenantId, q_get_result_printing_tracking_by_ascensionid, [ascensionid]);
     }

     static async updateResultPrintingTracking(
          tenantId: number,
          trackid: number,
          ascensionid: number,
          employeeid: number,
          action: "view" | "printed",
          actionon: Date | string,
     ) {
          return await promisifyQuery(tenantId, q_update_result_printing_tracking, [
               ascensionid,
               employeeid,
               action,
               actionon,
               trackid,
          ]);
     }

     static async deleteResultPrintingTracking(tenantId: number, trackid: number) {
          return await promisifyQuery(tenantId, q_delete_result_printing_tracking, [trackid]);
     }
}
