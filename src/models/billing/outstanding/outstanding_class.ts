import { Knex } from "knex";
import KnexConnection from "../../../database/KnexConnections"
import { promisifyQuery } from "../../../hooks/helper";
import { all_outstanding, outstanding_by_aging_range, outstanding_by_billing_or_transaction, outstanding_by_branch, outstanding_by_organization, outstanding_by_patient, outstanding_by_service_category, reconciliation_billing_vs_services, top_20_debtors } from "./billingOutstandingBreakdownQueries";



interface OutstandingReport {
      allOutstandings: any[],
          byPatient: any[],
          byBillingOrTransaction: any[],
          byServiceCategory: any[],
          byBranch: any[],
          byOrganization: any[],
          byAgingRange: any[],
          reconciliation: any[],
          top20Debtors: any[]
}


export default class OutstandingClass {
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }
     async getAlloutstandings(startdate: string, enddate: string) {
          const result = promisifyQuery(this.tenantId, all_outstanding, [startdate, enddate]);
          return result;
     }


     async getOutstandingByPatient(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, outstanding_by_patient, [startdate, enddate]);
          return result;
     }


     async getOutstandingByBillingOrTransaction(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, outstanding_by_billing_or_transaction, [startdate, enddate]);
          return result;
     }

     async getOutstandingByServiceCategory(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, outstanding_by_service_category, [startdate, enddate]);
          return result;
     }


     async getOutstandingByBranch(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, outstanding_by_branch, [startdate, enddate]);
          return result;
     }

     async getOutstandingByOrganization(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, outstanding_by_organization, [startdate, enddate]);
          return result;
     }


     async getOutstandingByAgingRange(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, outstanding_by_aging_range, [startdate, enddate]);
          return result;
     }


     async getReconciliationBetweenServicesAndBillings(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, reconciliation_billing_vs_services, [startdate, enddate]);
          return result;
     }


     async getTop20Debtors(startdate: string, enddate: string) {
          const result = await promisifyQuery(this.tenantId, top_20_debtors, [startdate, enddate]);
          return result;
     }


     async combinedOutstandingReport(startdate: string, enddate: string): Promise<OutstandingReport> {
console.log("Generating combined outstanding report for:", { startdate, enddate });
          return {
               allOutstandings: await this.getAlloutstandings(startdate, enddate),
               byPatient: await this.getOutstandingByPatient(startdate, enddate),
               byBillingOrTransaction: await this.getOutstandingByBillingOrTransaction(startdate, enddate),
               byServiceCategory: await this.getOutstandingByServiceCategory(startdate, enddate),
               byBranch: await this.getOutstandingByBranch(startdate, enddate),
               byOrganization: await this.getOutstandingByOrganization(startdate, enddate),
               byAgingRange: await this.getOutstandingByAgingRange(startdate, enddate),
               reconciliation: await this.getReconciliationBetweenServicesAndBillings(startdate, enddate),
               top20Debtors: await this.getTop20Debtors(startdate, enddate),
          };
     }
}