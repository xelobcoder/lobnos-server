"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const billingOutstandingBreakdownQueries_1 = require("./billingOutstandingBreakdownQueries");
class OutstandingClass {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async getAlloutstandings(startdate, enddate) {
        const result = (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.all_outstanding, [startdate, enddate]);
        return result;
    }
    async getOutstandingByPatient(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.outstanding_by_patient, [startdate, enddate]);
        return result;
    }
    async getOutstandingByBillingOrTransaction(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.outstanding_by_billing_or_transaction, [startdate, enddate]);
        return result;
    }
    async getOutstandingByServiceCategory(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.outstanding_by_service_category, [startdate, enddate]);
        return result;
    }
    async getOutstandingByBranch(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.outstanding_by_branch, [startdate, enddate]);
        return result;
    }
    async getOutstandingByOrganization(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.outstanding_by_organization, [startdate, enddate]);
        return result;
    }
    async getOutstandingByAgingRange(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.outstanding_by_aging_range, [startdate, enddate]);
        return result;
    }
    async getReconciliationBetweenServicesAndBillings(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.reconciliation_billing_vs_services, [startdate, enddate]);
        return result;
    }
    async getTop20Debtors(startdate, enddate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, billingOutstandingBreakdownQueries_1.top_20_debtors, [startdate, enddate]);
        return result;
    }
    async combinedOutstandingReport(startdate, enddate) {
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
exports.default = OutstandingClass;
