"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTrackingRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const CommissionBatchPaymentServicesRepo_1 = require("./CommissionBatchPaymentServicesRepo");
const CommissionServiceFactory_1 = require("./commission-configurations/services/CommissionServiceFactory");
class CommissionTrackingRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.batchRepo = new CommissionBatchPaymentServicesRepo_1.CommissionBatchPaymentServicesRepo(tenantId);
    }
    async getCommissionTrackingById(id) {
        try {
            const conn = await this.connection;
            return await conn('commission_tracking')
                .where({ id })
                .first();
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking:', error);
            throw error;
        }
    }
    async getCommissionTrackingByType(type, page, count, recipient_id, start_date, end_date) {
        try {
            const conn = await this.connection;
            const applicationsettings = await new appset_1.default().getAllAppSettings(this.tenantId);
            let isPaidAmountUsed = false;
            if (applicationsettings) {
                isPaidAmountUsed = applicationsettings['useamountpaidforcommissioncalculation'] ? parseInt((applicationsettings['useamountpaidforcommissioncalculation']).toString()) == 1 : false;
            }
            let query = conn('commission_tracking as ct')
                .select('ct.*', 'ds.totalpayable', "ds.paidamount", 'ds.serviceAddedOn', 'ct.*', 'ct.commission_type', 'ds.serviceCategory', 'tp.name as test_name')
                .leftJoin('dboservices as ds', 'ct.service_id', 'ds.serviceid')
                .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                .where(conn.raw("ds.serviceCategory IN ('CLINICIAN_SPECIAL_BILLING','ORGANIZATION')"))
                .andWhere((builder) => {
                builder.whereRaw('ds.clinicianId IS NOT NULL').orWhereRaw('ds.organizationId IS NOT NULL');
            });
            if (type === 'clinician') {
                query = query
                    .leftJoin("clinicianbasicinfo as cbi", "ct.recipient_id", "cbi.id")
                    .select('cbi.name as recipient_name');
            }
            else if (type === 'organization') {
                query = query
                    .leftJoin("organization as obi", "ct.recipient_id", "obi.id")
                    .select('obi.name as recipient_name');
            }
            if (recipient_id) {
                query = query.andWhere('ct.recipient_id', recipient_id);
            }
            if (type) {
                query = query.andWhere('ct.recipient_type', type);
            }
            if (start_date && end_date) {
                query = query.andWhereBetween(conn.raw('DATE(ds.serviceAddedOn)'), [start_date, end_date]);
            }
            if (page !== undefined && count !== undefined) {
                const offset = (page - 1) * count;
                query = query.offset(offset).limit(count);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking by type:', error);
            throw error;
        }
    }
    async updateCommissionTracking(id, updates) {
        try {
            const conn = await this.connection;
            return await conn('commission_tracking')
                .where({ id })
                .update(updates);
        }
        catch (error) {
            logger_1.default.error('Error updating commission tracking:', error);
            throw error;
        }
    }
    async validateServiceTrackedMultiple(servicesArray) {
        try {
            const conn = await this.connection;
            const results = await conn('commission_tracking')
                .whereIn('service_id', servicesArray.map(id => parseInt(id.toString())))
                .select('service_id');
            const trackedServiceIds = results.map((row) => row.service_id);
            const untrackedServiceIds = servicesArray.filter(id => !trackedServiceIds.includes(id));
            return untrackedServiceIds;
        }
        catch (error) {
            logger_1.default.error('Error validating multiple tracked services:', error);
            throw error;
        }
    }
    async calculateCommissionDue(servicesArray) {
        var _a, _b;
        try {
            const conn = await this.connection;
            const services = await conn('dboservices')
                .whereIn('serviceid', servicesArray)
                .select('serviceid', 'totalpayable', 'clinicianId', 'organizationId', 'serviceCategory', 'serviceAddedOn');
            if (services.length === 0) {
                return 0;
            }
            const engine = CommissionServiceFactory_1.CommissionServiceFactory.createEngine(this.tenantId);
            let insertedCount = 0;
            for (const service of services) {
                const completionDate = service.serviceAddedOn
                    ? new Date(service.serviceAddedOn)
                    : new Date();
                if (!service.clinicianId && !service.organizationId) {
                    continue;
                }
                const input = {
                    service_id: service.serviceid,
                    service_amount: parseFloat(String(service.totalpayable)) || 0,
                    service_category: service.serviceCategory || 'CLINICIAN_SPECIAL_BILLING',
                    clinician_id: (_a = service.clinicianId) !== null && _a !== void 0 ? _a : undefined,
                    organization_id: (_b = service.organizationId) !== null && _b !== void 0 ? _b : 0,
                    completion_date: Number.isNaN(completionDate.getTime()) ? new Date() : completionDate,
                };
                const result = await engine.executeCommissionCalculation(input);
                if (result.reason === 'SUCCESS' && result.tracking_id) {
                    insertedCount += 1;
                }
            }
            return insertedCount;
        }
        catch (error) {
            logger_1.default.error('Error calculating commission due:', error);
            throw error;
        }
    }
    async getUntrackedServices(recipientType, recipientId, page, count) {
        try {
            const conn = await this.connection;
            let trackedServiceIds = [];
            if (recipientType && recipientId !== undefined) {
                trackedServiceIds = await conn('commission_tracking')
                    .where('recipient_type', recipientType)
                    .andWhere('recipient_id', recipientId)
                    .select('service_id');
            }
            else {
                // If no recipient specified, get all tracked service IDs
                trackedServiceIds = await conn('commission_tracking')
                    .select('service_id');
            }
            const trackedIds = trackedServiceIds.map((row) => row.service_id);
            let query = conn('dboservices')
                .select('serviceid', 'totalpayable', 'paidamount', 'status', 'paymentstatus', 'serviceAddedOn', 'serviceCategory', 'clinicianId', 'organizationId', 'tp.name as test_name')
                .leftJoin('test_panels as tp', 'dboservices.trackId', 'tp.id')
                .whereNotIn('serviceid', trackedIds)
                .andWhere(conn.raw("serviceCategory IN ('CLINICIAN_SPECIAL_BILLING','ORGANIZATION')"))
                .whereNotIn('status', ['voided', 'cancelled', 'refunded', 'written-off']);
            if (recipientType === 'clinician' && recipientId !== undefined) {
                query = query.andWhere('clinicianId', recipientId);
            }
            else if (recipientType === 'organization' && recipientId !== undefined) {
                query = query.andWhere('organizationId', recipientId);
            }
            if (page !== undefined && count !== undefined) {
                const offset = (page - 1) * count;
                query = query.offset(offset).limit(count);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching untracked services:', error);
            throw error;
        }
    }
}
exports.CommissionTrackingRepo = CommissionTrackingRepo;
/*
So, the approach is that we are going to have the commission deal and we are going to have the amount paid. There are going to be instances where the commission deal will be greater than the amount paid. That is always at the discretion of the company to decide how much to pay to the clinician for the commission end. Now, instances they'll pay the full commission, instances they'll pay the right amount or less. Let's establish that first.
*/ 
