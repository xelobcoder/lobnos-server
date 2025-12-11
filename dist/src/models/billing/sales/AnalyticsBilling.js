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
    const isDateKey = ['dailySalesTrend'].includes(key);
    const year = startdate ? new Date(startdate).getFullYear() : new Date().getFullYear();
    if (key === 'monthlySalesTrend') {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate[key], [year, year]);
    }
    else if (key === 'yearlySalesTrend') {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate[key], [year, year]);
    }
    else if (key === 'weeklySalesTrend') {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalytics[key], [year, year]);
    }
    else if (startdate && enddate && isDateKey) {
        const params = [startdate, enddate, startdate, enddate];
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate[key], params);
    }
    return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalytics[key], [year]);
}
exports.UtilityFinancial = UtilityFinancial;
