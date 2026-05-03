"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_MonthWeeklySalesSummaryPartition = exports.q_MonthWeeklySalesSummary = exports.q_dailySalesSummary = void 0;
const helper_1 = require("../../../hooks/helper");
class SalesSummaryClassQueriesModels {
    constructor(branchid, patientid, clinicianid) {
        this.patientid = patientid;
        this.clinicianid = clinicianid;
        this.branchid = branchid;
    }
    buildYearlyQuery() {
        let query = `SELECT 
			SUM(cost) AS salesAmount,
			YEAR(b.billedon) AS 'Year'
			FROM dboservices AS b`;
        if (this.patientid)
            query += ` WHERE b.patientid = ${this.patientid}`;
        if (this.branchid !== "all")
            query += ` AND b.branchid = ${this.branchid}`;
        if (!this.patientid && this.branchid === 'all' && this.clinicianid) {
            query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;
        }
        query += ` GROUP BY YEAR(b.billedon)`;
        return query;
    }
    buildMonthlyQuery() {
        let query = `SELECT
			SUM(PAYABLE) AS salesAmount,
			COUNT(b.billingid) AS totalCases,
			MONTHNAME(b.billedon) AS 'Month'
			FROM billing AS b
			WHERE YEAR(b.billedon) = YEAR(CURDATE())`;
        if (this.patientid)
            query += ` AND b.patientid = ${this.patientid}`;
        if (this.branchid !== "all")
            query += ` AND b.branchid = ${this.branchid}`;
        if (this.clinicianid)
            query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;
        query += ` GROUP BY MONTH(b.billedon)`;
        return query;
    }
    buildDailyQuery() {
        let query = `SELECT
			SUM(b.PAYABLE) AS salesAmount,
			COUNT(b.billingid) AS totalCases,
			SUM(b.DISCOUNT) AS discount,
			SUM(paid) AS totalAmountReceived,
			b.billedon AS date,
			DAY(b.billedon) AS 'Day'
			FROM billing AS b
			WHERE YEAR(b.billedon) = YEAR(CURDATE()) AND MONTH(b.billedon) = MONTH(CURDATE())`;
        if (this.patientid)
            query += ` AND b.patientid = ${this.patientid}`;
        if (this.branchid !== "all")
            query += ` AND b.branchid = ${this.branchid}`;
        if (this.clinicianid)
            query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;
        query += ` GROUP BY DAY(b.billedon)`;
        return query;
    }
    buildWeeklyQuery() {
        let query = `SELECT
			SUM(PAYABLE) AS salesAmount,
			CASE
				WHEN DAY(b.billedon) BETWEEN 1 AND 7 THEN 'First Week'
				WHEN DAY(b.billedon) BETWEEN 8 AND 14 THEN 'Second Week'
				WHEN DAY(b.billedon) BETWEEN 15 AND 21 THEN 'Third Week'
				WHEN DAY(b.billedon) BETWEEN 22 AND 31 THEN 'Fourth Week'
			END AS 'Week',
			COUNT(b.billingid) AS totalCases
		FROM billing AS b
		WHERE YEAR(b.billedon) = YEAR(CURDATE())
		AND MONTH(b.billedon) = MONTH(CURDATE())`;
        if (this.patientid)
            query += ` AND b.patientid = ${this.patientid}`;
        if (this.branchid !== "all")
            query += ` AND b.branchid = ${this.branchid}`;
        if (this.clinicianid)
            query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;
        query += ` GROUP BY WEEK`;
        return query;
    }
    async fetchYearlySales(tenantId) {
        const query = this.buildYearlyQuery();
        return (0, helper_1.promisifyQuery)(tenantId, query);
    }
    async fetchMonthlySales(tenantId) {
        const query = this.buildMonthlyQuery();
        return (0, helper_1.promisifyQuery)(tenantId, query);
    }
    async fetchDailySales(tenantId) {
        const query = this.buildDailyQuery();
        return (0, helper_1.promisifyQuery)(tenantId, query);
    }
    async fetchWeeklySales(tenantId) {
        const query = this.buildWeeklyQuery();
        return (0, helper_1.promisifyQuery)(tenantId, query);
    }
}
exports.default = SalesSummaryClassQueriesModels;
exports.q_dailySalesSummary = `SELECT 
		SUM(payable) AS salesAmount, 
		COUNT(billingid) AS totalCases, 
		SUM(discount) AS discount, 
		SUM(paid_amount) AS totalAmountReceived, 
		b.billedon AS date, 
		DAY(b.billedon) AS 'Day' 
		FROM billing 
		WHERE DATE(billedon) = ?`;
exports.q_MonthWeeklySalesSummary = `SELECT
		SUM(payable) AS salesAmount,
		CASE
			WHEN DAY(b.billedon) BETWEEN 1 AND 7 THEN 'First Week'
			WHEN DAY(b.billedon) BETWEEN 8 AND 14 THEN 'Second Week'
			WHEN DAY(b.billedon) BETWEEN 15 AND 21 THEN 'Third Week'
			WHEN DAY(b.billedon) BETWEEN 22 AND 31 THEN 'Fourth Week'
		END AS 'Week',
		COUNT(b.billingid) AS totalCases
		FROM billing AS b
		WHERE YEAR(b.billedon) = YEAR(CURRENT_DATE)
		AND MONTH(b.billedon) = MONTH(CURRENT_DATE)`;
exports.q_MonthWeeklySalesSummaryPartition = `SELECT 
			OVER PARTITION(?)
			SUM(payable) AS salesAmount,
			CASE
				WHEN DAY(b.billedon) BETWEEN 1 AND 7 THEN 'First Week'
				WHEN DAY(b.billedon) BETWEEN 8 AND 14 THEN 'Second Week'
				WHEN DAY(b.billedon) BETWEEN 15 AND 21 THEN 'Third Week'
				WHEN DAY(b.billedon) BETWEEN 22 AND 31 THEN 'Fourth Week'
			END AS 'Week',
			COUNT(b.billingid) AS totalCases
			FROM billing AS b
			WHERE YEAR(b.billedon) = YEAR(CURRENT_DATE)
			AND MONTH(b.billedon) = MONTH(CURRENT_DATE)`;
