"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtilityFinancial = void 0;
const helper_1 = require("../../../hooks/helper");
const billingAnalqueries_1 = require("../billingAnalqueries");
class FinancialAnalyticsPrimeLabSystem {
    constructor(branchid, tenantId) {
        this.branchid = branchid;
        this.tenantId = tenantId;
    }
}
exports.default = FinancialAnalyticsPrimeLabSystem;
async function UtilityFinancial(tenantId, key, branchid, startdate, enddate) {
    if (startdate && enddate)
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate[key], [startdate, enddate]);
    return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalytics[key]);
}
exports.UtilityFinancial = UtilityFinancial;
