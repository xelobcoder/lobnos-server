"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManagementRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class TransactionManagementRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.db = (0, KnexConnections_1.default)(this.tenantId);
    }
    async getBilling(billingId) {
        const db = await this.db;
        return db('billing').where({ billingid: billingId }).first();
    }
    async updateBilling(billingId, updates, trx) {
        const db = trx || await this.db;
        return db('billing').where({ billingid: billingId }).update(updates);
    }
    async getServices(billingId) {
        const db = await this.db;
        return db('dboservices').where({ billingid: billingId });
    }
    async updateService(serviceId, updates, trx) {
        const db = trx || await this.db;
        return db('dboservices').where({ serviceid: serviceId }).update(updates);
    }
    async getBillingAuditRaw(billingId) {
        const db = await this.db;
        return db('billing_audit')
            .where({ billingid: billingId })
            .orderBy('action_timestamp', 'asc');
    }
    async getServicesAuditRaw(billingId) {
        const db = await this.db;
        return db('dboservices_audit')
            .where({ billingid: billingId })
            .orderBy('action_timestamp', 'asc');
    }
    async updatePaymentHistoryRecord(keyId, updates, trx) {
        const db = trx || await this.db;
        return db('billinghx')
            .where({ KeyID: keyId })
            .update(updates);
    }
    async getPaymentHistoryByBillingId(billingId) {
        const db = await this.db;
        return db('billinghx')
            .where({ Billingid: billingId })
            .orderBy('KeyID', 'asc');
    }
    async getPaymentHistoryByKeyId(keyId) {
        const db = await this.db;
        return db('billinghx').where({ KeyID: keyId }).first();
    }
    async getFullBillingDetails(billingId) {
        const db = await this.db;
        return db('billing as b')
            .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
            .leftJoin('branch as br', 'b.branchid', 'br.branchid')
            .leftJoin('roles as r', 'b.lastupdatedby', 'r.employeeid')
            .select('b.*', 'np.firstname as patient_firstname', 'np.lastname as patient_lastname', 'np.middlename as patient_middlename', 'np.fullpatientid as patient_identifier', 'br.name as branch_name', 'r.username as last_updated_by_name')
            .where('b.billingid', billingId)
            .first();
    }
    async getServicesWithDetails(billingId) {
        const db = await this.db;
        return db('dboservices as ds')
            .leftJoin('clinicianbasicinfo as c', 'ds.clinicianId', 'c.id')
            .leftJoin('organization as o', 'ds.organizationId', 'o.id')
            .leftJoin('test_panels as tp', function () {
            this.on('ds.trackId', '=', 'tp.id')
                .andOn('ds.categoryTrackId', '<', db.raw(6));
        })
            .leftJoin('additionalservices as ads', function () {
            this.on('ds.trackId', '=', 'ads.keyid')
                .andOn('ds.categoryTrackId', '=', db.raw(6));
        })
            .leftJoin('outsourcedtesttracking as ott', 'ds.serviceid', 'ott.serviceid')
            .leftJoin('outsourcingorganization as oo', 'ott.outsourceid', 'oo.outsourceid')
            .leftJoin('dbobillingrefundtable as rf', 'ds.serviceid', 'rf.serviceid')
            .leftJoin('roles as r1', 'rf.firstWitness', 'r1.employeeid')
            .leftJoin('roles as r2', 'rf.secondWitness', 'r2.employeeid')
            .leftJoin('roles as r3', 'rf.thirdWitness', 'r3.employeeid')
            .select('ds.*', 'c.name as clinician_name', 'o.name as organization_name', db.raw('COALESCE(tp.name, ads.serviceName) as display_name'), 'oo.name as outsource_organization_name', 'ott.status as outsource_status', 'ott.comments as outsource_comments', 'rf.refundid', 'rf.isRefundInitiated', 'rf.isRefundApproved', 'rf.isRefundCompleted', 'rf.amountRefunded', 'r1.username as first_witness_name', 'r2.username as second_witness_name', 'r3.username as third_witness_name')
            .where('ds.billingid', billingId);
    }
    async getPaymentHistoryWithDetails(billingId) {
        const db = await this.db;
        return db('billinghx as bhx')
            .leftJoin('paymentmodes as pm', 'bhx.PaymentMode', 'pm.KeyID')
            .leftJoin('roles as r', 'bhx.employeeid', 'r.employeeid')
            .select('bhx.*', 'pm.PaymentMode as payment_mode_name', 'r.username as employee_name')
            .where('bhx.Billingid', billingId)
            .orderBy('bhx.KeyID', 'asc');
    }
    async startTransaction() {
        const db = await this.db;
        return db.transaction();
    }
}
exports.TransactionManagementRepository = TransactionManagementRepository;
