"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Services = void 0;
const queries_1 = require("./queries");
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const billingclientTypes_1 = require("../billing/billingclientTypes");
const helper_1 = require("../../hooks/helper");
class Services {
    constructor(serviceid) {
        this.serviceid = serviceid;
    }
    async createAService(tenantId, name, price, employeeid) {
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_create_service, [name, price, employeeid]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (error) {
            return (error && error.code && error.code == "ER_DUP_ENTRY")
                ? "Duplicates.Item already Exist" /* MysqlOperationsFailure.duplicates */
                : 'ERROR';
        }
    }
    static async findAllServicesAssociatedWithBillingId(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_all_services_associated_billingid, [billingid]);
    }
    static async findAllServicesAssociatedWithBillingIdExclusive(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_all_services_associated_billingid_exclusive, [billingid]);
    }
    async updateAservice(tenantId, name, price, employeeid, serviceid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_service_created, [name, price, employeeid, serviceid]);
        return (0, helper_1.rowAffected)(result);
    }
    async deleteAservice(tenantId) {
        if (!this.serviceid)
            return "such id not found" /* OperationsFailures.unfoundID */;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_delete_service_created, [this.serviceid]);
        return (0, helper_1.rowAffected)(result);
    }
    async getAService(tenantId) {
        if (!this.serviceid)
            return "such id not found" /* OperationsFailures.unfoundID */;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_specific_services, [this.serviceid]);
        return result;
    }
    async getAllservices(tenantId, count, page) {
        if (count && page) {
            return await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_getAllServicesByCount, undefined, tenantId);
        }
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_getAllServices);
    }
    async deleteServicesAssociatedToBillingId(tenantId, billingid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_delete_billed_services_using_billingid, [billingid]);
        return (0, helper_1.rowAffected)(result);
    }
    async getServiceProgress(tenantId) {
        const row = await new TiifuWorkingClass_1.TiifuWorkingClass("servicestracking").findOne(tenantId, "serviceid", this.serviceid);
        if (row.hasOwnProperty('status')) {
            switch (row['status']) {
                case 1:
                    return billingclientTypes_1.ClientPlsServiceLifecycle[1];
                case 0:
                    return billingclientTypes_1.ClientPlsServiceLifecycle[0];
                case 2:
                    return billingclientTypes_1.ClientPlsServiceLifecycle[2];
                default:
                    return null;
            }
        }
        return null;
    }
    static async hasServiceWithBillingIdAndTrackId(tenantId, billingid, categoryTrackId, trackId) {
        if (categoryTrackId && billingclientTypes_1.serviceCategory[categoryTrackId]) {
            let count = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_services_exist_using_billId_trackId, [trackId, billingid]);
            return count[0]['count'] > 0;
        }
        return false;
    }
}
exports.Services = Services;
exports.default = Services;
