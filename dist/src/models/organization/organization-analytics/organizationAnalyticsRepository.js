"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationAnalyticsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class OrganizationAnalyticsRepository {
    constructor(tenantId) {
        this.q_get_organizations_commission_by_date = `
    SELECT
        o.id AS organization_id,
        o.name AS organization_name,
        o.mobile AS organization_phone,
        DATE(s.serviceAddedOn) AS service_date,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_payable,
        SUM(s.paidamount) AS total_paid,
        SUM(COALESCE(ct.commission_due, 0)) AS commission_earned_total
    FROM dboservices s
    INNER JOIN organization o
        ON s.organizationId = o.id
    LEFT JOIN commission_tracking ct
        ON ct.serviceid = s.serviceid AND ct.type = 'organization' AND ct.recipient_id = o.id
    LEFT JOIN commission_batch_payment_services AS cbps
        ON cbps.serviceid = s.serviceid
    WHERE
        s.serviceCategory = 'ORGANIZATION'
        AND s.status = 'active'
        AND s.isRefunded = 0
        AND s.paymentstatus != 'pending'
        AND DATE(s.serviceAddedOn) >= ?
        AND DATE(s.serviceAddedOn) <= ?
        AND s.organizationId IS NOT NULL
        AND cbps.serviceid IS NULL
    GROUP BY
        o.id
    ORDER BY ?
    LIMIT ? OFFSET ?;
`;
        this.q_get_organization_commission = `
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        o.id AS organization_id,
        o.name AS organization_name,
        s.serviceid,
        o.mobile AS organization_phone,
        o.type AS organization_type,
        o.location AS organization_location,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_payable,
        SUM(s.paidamount) AS total_paid,
        COALESCE(ct.commission_due, 0) AS commission_earned
    FROM dboservices s
    INNER JOIN organization o
        ON s.organizationId = o.id
    LEFT JOIN commission_tracking ct
        ON ct.serviceid = s.serviceid AND ct.type = 'organization' AND ct.recipient_id = o.id
    LEFT JOIN commission_batch_payment_services AS cbps
        ON cbps.serviceid = s.serviceid
    WHERE
        s.organizationId = ?
        AND s.serviceCategory = 'ORGANIZATION'
        AND s.status = 'active'
        AND DATE(s.serviceAddedOn) >= ?
        AND s.isRefunded = 0
        AND s.paymentstatus != 'pending'
        AND DATE(s.serviceAddedOn) <= ?
        AND cbps.serviceid IS NULL
    GROUP BY 
       s.serviceid
    ORDER BY 
        service_date DESC
`;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    static async getOrganizationsCommissionByDate(tenantId, params) {
        const { startDate, endDate, page = 1, count = 10, sortby = 'DESC' } = params;
        const offset = (page - 1) * count;
        const repository = new OrganizationAnalyticsRepository(tenantId);
        const connection = await repository.connection;
        const [result] = await connection.raw(repository.q_get_organizations_commission_by_date, [startDate, endDate, sortby, count, offset]);
        return Array.isArray(result) ? result : [];
    }
    static async getOrganizationCommission(tenantId, organizationId, startDate, endDate) {
        const repository = new OrganizationAnalyticsRepository(tenantId);
        const connection = await repository.connection;
        const [result] = await connection.raw(repository.q_get_organization_commission, [organizationId, startDate, endDate]);
        return Array.isArray(result) ? result : [];
    }
}
exports.OrganizationAnalyticsRepository = OrganizationAnalyticsRepository;
