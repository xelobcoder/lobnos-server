import {
    q_create_service,
    q_delete_billed_services_using_billingid,
    q_delete_service_created,
    q_get_all_services_associated_billingid,
    q_get_all_services_associated_billingid_exclusive,
    q_get_specific_services,
    q_getAllServices,
    q_getAllServicesByCount,
    q_services_exist_using_billId_trackId,
    q_update_service_created
} from "./queries";
import { MysqlOperationsFailure, OperationsFailures } from "../operations/types";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { ClientPlsServiceLifecycle, serviceCategory } from "../billing/billingclientTypes";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";

export class Services {
    private serviceid: number;
    constructor(serviceid: number) {
        this.serviceid = serviceid;
    }

    async createAService(tenantId: number, name: string, price: number, employeeid: number): Promise<boolean | string> {
        try {
            const result = await promisifyQuery(tenantId, q_create_service, [name, price, employeeid]);
            return rowAffected(result);
        } catch (error) {
            return (error && error.code && error.code == "ER_DUP_ENTRY")
                ? MysqlOperationsFailure.duplicates
                : 'ERROR';
        }
    }

    public static async findAllServicesAssociatedWithBillingId(tenantId: number, billingid: number) {
        return await promisifyQuery(tenantId, q_get_all_services_associated_billingid, [billingid]);
    }

    public static async findAllServicesAssociatedWithBillingIdExclusive(tenantId: number, billingid: number) {
        return await promisifyQuery(tenantId, q_get_all_services_associated_billingid_exclusive, [billingid]);
    }

    public static async getRefererFacilityByBillingId(tenantId: number, billingid: number) {
        try {
            const query = `
                SELECT 
                    ds.clinicianId,
                    ds.organizationId,
                    org.name as facility_name,
                    org.email as facility_email,
                    org.mobile as facility_phone,
                    cb.name as clinician_name,
                    cb.email as clinician_email,
                    cb.phone as clinician_phone
                FROM dboservices ds
                LEFT JOIN organization org ON ds.organizationId = org.id
                LEFT JOIN clinicianbasicinfo cb ON ds.clinicianId = cb.id
                WHERE ds.billingid = ?
                LIMIT 1
            `;
            const result = await promisifyQuery(tenantId, query, [billingid]);
            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error fetching referrer facility:', error);
            return null;
        }
    }

    async updateAservice(tenantId: number, name: string, price: number, employeeid: number, serviceid: number): Promise<boolean> {
        const result = await promisifyQuery(tenantId, q_update_service_created, [name, price, employeeid, serviceid]);
        return rowAffected(result);
    }

    async deleteAservice(tenantId: number): Promise<boolean | string> {
        if (!this.serviceid) return OperationsFailures.unfoundID;
        const result = await promisifyQuery(tenantId, q_delete_service_created, [this.serviceid]);
        return rowAffected(result);
    }

    async getAService(tenantId: number): Promise<[] | string> {
        if (!this.serviceid) return OperationsFailures.unfoundID;
        const result = await promisifyQuery(tenantId, q_get_specific_services, [this.serviceid]);
        return result;
    }

    async getAllservices(tenantId: number, count?: number, page?: number) {
        if (count && page) {
            return await paginationQuery({ count, page }, q_getAllServicesByCount, undefined, tenantId);
        }
        return await promisifyQuery(tenantId, q_getAllServices);
    }

    async deleteServicesAssociatedToBillingId(tenantId: number, billingid: number) {
        const result = await promisifyQuery(tenantId, q_delete_billed_services_using_billingid, [billingid]);
        return rowAffected(result);
    }

    public async getServiceProgress(tenantId: number) {
        const row = await new TiifuWorkingClass("servicestracking").findOne(tenantId, "serviceid", this.serviceid);
        if (row.hasOwnProperty('status')) {
            switch (row['status']) {
                case 1:
                    return ClientPlsServiceLifecycle[1];
                case 0:
                    return ClientPlsServiceLifecycle[0];
                case 2:
                    return ClientPlsServiceLifecycle[2];
                default:
                    return null;
            }
        }
        return null;
    }

    public static async hasServiceWithBillingIdAndTrackId(
        tenantId: number,
        billingid: number,
        categoryTrackId: number,
        trackId: number
    ) {
        if (categoryTrackId && serviceCategory[categoryTrackId]) {
            let count = await promisifyQuery(tenantId, q_services_exist_using_billId_trackId, [trackId, billingid]);
            return count[0]['count'] > 0;
        }
        return false;
    }
}

export default Services;
