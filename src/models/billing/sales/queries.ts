import { promisifyQuery } from "../../../hooks/helper";


interface SalesSummary {
	salesAmount: number;
	totalCases: number;
	discount?: number;
	totalAmountReceived?: number;
	date?: string;
	day?: string;
	week?: string;
}

export default class SalesSummaryClassQueriesModels {
	readonly patientid: number;
	readonly branchid: number | string;
	readonly clinicianid: number;

	constructor(branchid: number, patientid: number, clinicianid: number) {
		this.patientid = patientid;
		this.clinicianid = clinicianid;
		this.branchid = branchid;
	}

	private buildYearlyQuery(): string {
		let query = `SELECT 
			SUM(cost) AS salesAmount,
			YEAR(b.billedon) AS 'Year'
			FROM dboservices AS b`;

		if (this.patientid) query += ` WHERE b.patientid = ${this.patientid}`;
		if (this.branchid !== "all") query += ` AND b.branchid = ${this.branchid}`;
		if (!this.patientid && this.branchid === 'all' && this.clinicianid) {
			query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;
		}

		query += ` GROUP BY YEAR(b.billedon)`;
		return query;
	}

	private buildMonthlyQuery(): string {
		let query = `SELECT
			SUM(PAYABLE) AS salesAmount,
			COUNT(b.billingid) AS totalCases,
			MONTHNAME(b.billedon) AS 'Month'
			FROM billing AS b
			WHERE YEAR(b.billedon) = YEAR(CURDATE())`;

		if (this.patientid) query += ` AND b.patientid = ${this.patientid}`;
		if (this.branchid !== "all") query += ` AND b.branchid = ${this.branchid}`;
		if (this.clinicianid) query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;

		query += ` GROUP BY MONTH(b.billedon)`;
		return query;
	}

	private buildDailyQuery(): string {
		let query = `SELECT
			SUM(b.PAYABLE) AS salesAmount,
			COUNT(b.billingid) AS totalCases,
			SUM(b.DISCOUNT) AS discount,
			SUM(paid) AS totalAmountReceived,
			b.billedon AS date,
			DAY(b.billedon) AS 'Day'
			FROM billing AS b
			WHERE YEAR(b.billedon) = YEAR(CURDATE()) AND MONTH(b.billedon) = MONTH(CURDATE())`;

		if (this.patientid) query += ` AND b.patientid = ${this.patientid}`;
		if (this.branchid !== "all") query += ` AND b.branchid = ${this.branchid}`;
		if (this.clinicianid) query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;

		query += ` GROUP BY DAY(b.billedon)`;
		return query;
	}

	private buildWeeklyQuery(): string {
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

		if (this.patientid) query += ` AND b.patientid = ${this.patientid}`;
		if (this.branchid !== "all") query += ` AND b.branchid = ${this.branchid}`;
		if (this.clinicianid) query += ` AND b.clinician = ${parseInt(this.clinicianid.toString())}`;

		query += ` GROUP BY WEEK`;
		return query;
	}

	async fetchYearlySales(tenantId:number): Promise<SalesSummary[]> {
		const query = this.buildYearlyQuery();
		return promisifyQuery(tenantId,query);
	}

	async fetchMonthlySales(tenantId:number): Promise<SalesSummary[]> {
		const query = this.buildMonthlyQuery();
		return promisifyQuery(tenantId,query);
	}

	async fetchDailySales(tenantId:number): Promise<SalesSummary[]> {
		const query = this.buildDailyQuery();
		return promisifyQuery(tenantId,query);
	}

	async fetchWeeklySales(tenantId:number): Promise<SalesSummary[]> {
		const query = this.buildWeeklyQuery();
		return promisifyQuery(tenantId,query);
	}
}



export const q_dailySalesSummary: string = `SELECT 
		SUM(payable) AS salesAmount, 
		COUNT(billingid) AS totalCases, 
		SUM(discount) AS discount, 
		SUM(paid_amount) AS totalAmountReceived, 
		b.billedon AS date, 
		DAY(b.billedon) AS 'Day' 
		FROM billing 
		WHERE DATE(billedon) = ?`;

export const q_MonthWeeklySalesSummary: string = `SELECT
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

export const q_MonthWeeklySalesSummaryPartition: string = `SELECT 
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
