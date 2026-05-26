"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class OutstandingClass {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async getKnex() {
        return await (0, KnexConnections_1.default)(this.tenantId);
    }
    validateDateRange(startdate, enddate) {
        if (!startdate || !enddate)
            return false;
        const start = new Date(startdate);
        const end = new Date(enddate);
        return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
    }
    applyCommonFilters(query, startdate, enddate, organizationId) {
        query
            .whereIn('dboservices.status', ['active', 'refunded'])
            .where(function () {
            this.where('dboservices.isDeleted', 0).orWhereNull('dboservices.isDeleted');
        })
            .whereRaw('DATE(dboservices.serviceAddedOn) BETWEEN ? AND ?', [startdate, enddate]);
        if (organizationId !== undefined && organizationId !== null && organizationId !== '') {
            const orgId = parseInt(organizationId.toString());
            if (orgId === 0) {
                query.whereNull('dboservices.organizationId');
            }
            else if (!isNaN(orgId)) {
                query.where('dboservices.organizationId', orgId);
            }
        }
        return query;
    }
    async getAlloutstandings(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .sum('dboservices.outstanding as total_outstanding')
            .where('dboservices.outstanding', '>', 0);
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingByPatient(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .leftJoin('billing', 'billing.billingid', 'dboservices.billingid')
            .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
            .select('billing.patientid', knex.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) AS patient_name"), knex.raw('COUNT(DISTINCT dboservices.billingid) AS invoices'), knex.raw('SUM(dboservices.totalcost) AS total_billed'), knex.raw('SUM(dboservices.paidamount) AS total_paid'), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .where('dboservices.outstanding', '>', 0)
            .groupBy('billing.patientid')
            .orderBy('total_outstanding', 'desc');
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingByBillingOrTransaction(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .join('billing', 'billing.billingid', 'dboservices.billingid')
            .select('dboservices.billingid', 'billing.patientid', 'billing.status as billing_status', 'dboservices.serviceAddedOn as billing_date', knex.raw('SUM(dboservices.totalcost) AS total_billed'), knex.raw('SUM(dboservices.paidamount) AS total_paid'), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .groupBy('dboservices.billingid')
            .having('total_outstanding', '>', 0)
            .orderBy('total_outstanding', 'desc');
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingByServiceCategory(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .select('dboservices.serviceCategory', knex.raw('COUNT(*) AS services'), knex.raw('SUM(dboservices.totalcost) AS total_billed'), knex.raw('SUM(dboservices.paidamount) AS total_paid'), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .groupBy('dboservices.serviceCategory')
            .orderBy('total_outstanding', 'desc');
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingByBranch(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .leftJoin('branch', 'dboservices.branchid', 'branch.branchid')
            .select('dboservices.branchid', 'branch.name', knex.raw('COUNT(DISTINCT dboservices.billingid) AS invoices'), knex.raw('SUM(dboservices.totalcost) AS total_billed'), knex.raw('SUM(dboservices.paidamount) AS total_paid'), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .groupBy('dboservices.branchid')
            .orderBy('total_outstanding', 'desc');
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingByOrganization(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .leftJoin('organization', 'dboservices.organizationId', 'organization.id')
            .select('dboservices.organizationId', knex.raw("COALESCE(organization.name, 'Individual') as name"), knex.raw('COUNT(DISTINCT dboservices.billingid) AS invoices'), knex.raw('SUM(dboservices.totalcost) AS total_billed'), knex.raw('SUM(dboservices.paidamount) AS total_paid'), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .groupBy('dboservices.organizationId', 'organization.name')
            .orderBy('total_outstanding', 'desc');
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingByAgingRange(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .select(knex.raw(`
                         CASE
                              WHEN DATEDIFF(CURDATE(), DATE(dboservices.serviceAddedOn)) <= 7 THEN '0–7 days'
                              WHEN DATEDIFF(CURDATE(), DATE(dboservices.serviceAddedOn)) BETWEEN 8 AND 30 THEN '8–30 days'
                              WHEN DATEDIFF(CURDATE(), DATE(dboservices.serviceAddedOn)) BETWEEN 31 AND 90 THEN '31–90 days'
                              ELSE '>90 days'
                         END AS aging_bucket
                    `), knex.raw('COUNT(*) AS services'), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .where('dboservices.outstanding', '>', 0)
            .groupBy('aging_bucket')
            .orderBy('aging_bucket');
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getReconciliationBetweenServicesAndBillings(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('billing')
            .join('dboservices', 'dboservices.billingid', 'billing.billingid')
            .select('billing.billingid', 'billing.outstanding as billing_outstanding', knex.raw('SUM(dboservices.outstanding) AS services_outstanding'), knex.raw('(billing.outstanding - SUM(dboservices.outstanding)) AS difference'))
            .where('billing.outstanding', '>', 0)
            .groupBy('billing.billingid')
            .having('difference', '!=', 0);
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getTop20Debtors(startdate, enddate) {
        const knex = await this.getKnex();
        let query = knex('dboservices')
            .join('billing', 'billing.billingid', 'dboservices.billingid')
            .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
            .select('billing.patientid', knex.raw('SUM(dboservices.outstanding) AS total_outstanding'), knex.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) AS patient_name"))
            .groupBy('billing.patientid')
            .orderBy('total_outstanding', 'desc')
            .limit(20);
        query = this.applyCommonFilters(query, startdate, enddate);
        return await query;
    }
    async getOutstandingBySpecificServiceCategory(startdate, enddate, serviceCategory, organizationId) {
        const knex = await this.getKnex();
        // 1. Get Outstanding by Organization
        const orgQuery = knex('dboservices')
            .leftJoin('organization', 'organization.id', 'dboservices.organizationId')
            .select(knex.raw("COALESCE(organization.name, 'Individual') as organization_name"), knex.raw('SUM(dboservices.outstanding) AS total_outstanding'))
            .where('dboservices.serviceCategory', serviceCategory)
            .where('dboservices.outstanding', '>', 0)
            .groupBy('organization_name')
            .orderBy('total_outstanding', 'desc');
        this.applyCommonFilters(orgQuery, startdate, enddate, organizationId);
        const byOrganization = await orgQuery;
        // 2. Get Individual Services grouped by Transaction
        const servicesQuery = knex('dboservices')
            .join('billing', 'billing.billingid', 'dboservices.billingid')
            .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
            .leftJoin('organization', 'organization.id', 'dboservices.organizationId')
            .leftJoin('test_panels', 'test_panels.id', 'dboservices.trackId')
            .select('dboservices.billingid', 'new_patients.patientid', knex.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) AS patient_name"), knex.raw("COALESCE(organization.name, 'Individual') as organization_name"), knex.raw("COALESCE(test_panels.name, 'Unknown Service') AS service_name"), 'dboservices.outstanding')
            .where('dboservices.serviceCategory', serviceCategory)
            .where('dboservices.outstanding', '>', 0)
            .orderBy('dboservices.billingid', 'desc');
        this.applyCommonFilters(servicesQuery, startdate, enddate, organizationId);
        const rawServices = await servicesQuery;
        // Grouping logic
        const transactionsMap = new Map();
        rawServices.forEach((row) => {
            if (!transactionsMap.has(row.billingid)) {
                transactionsMap.set(row.billingid, {
                    billingid: row.billingid,
                    patient_name: row.patient_name,
                    patientid: row.patientid,
                    organization_name: row.organization_name,
                    total_transaction_outstanding: 0,
                    services: []
                });
            }
            const transaction = transactionsMap.get(row.billingid);
            const outstandingAmount = parseFloat(row.outstanding.toString()) || 0;
            transaction.services.push({
                service_name: row.service_name,
                outstanding: outstandingAmount
            });
            transaction.total_transaction_outstanding = parseFloat((transaction.total_transaction_outstanding + outstandingAmount).toFixed(2));
        });
        return {
            byOrganization,
            byTransaction: Array.from(transactionsMap.values())
        };
    }
    async combinedOutstandingReport(startdate, enddate) {
        if (!this.validateDateRange(startdate, enddate)) {
            throw new Error("Invalid date range provided");
        }
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
