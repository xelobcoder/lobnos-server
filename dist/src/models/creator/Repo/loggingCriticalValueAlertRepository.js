"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../../hooks/logger"));
class LoggingCriticalValueAlertRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tableName = 'loggingcriticalvaluealert';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    normalizeSeenFilter(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        if (typeof value === 'number') {
            return value === 1 ? 1 : value === 0 ? 0 : undefined;
        }
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        const normalized = String(value).trim().toLowerCase();
        if (['1', 'true', 'yes', 'seen'].includes(normalized))
            return 1;
        if (['0', 'false', 'no', 'unseen'].includes(normalized))
            return 0;
        return undefined;
    }
    mapAlertsWithPatientInfo(rows) {
        return (Array.isArray(rows) ? rows : []).map((row) => {
            var _a, _b, _c, _d;
            const patientInfo = row.patientid || row.fullpatientid || row.patient_name || row.designation
                ? {
                    patientid: (_a = row.patientid) !== null && _a !== void 0 ? _a : null,
                    fullpatientid: (_b = row.fullpatientid) !== null && _b !== void 0 ? _b : null,
                    patientName: (_c = row.patient_name) !== null && _c !== void 0 ? _c : null,
                    designation: (_d = row.designation) !== null && _d !== void 0 ? _d : null,
                }
                : null;
            const { patientid, fullpatientid, firstname, middlename, lastname, gender, mobile_number, dob, designation, patient_name } = row, alertRow = __rest(row, ["patientid", "fullpatientid", "firstname", "middlename", "lastname", "gender", "mobile_number", "dob", "designation", "patient_name"]);
            return Object.assign(Object.assign({}, alertRow), (patientInfo ? { patientInfo } : {}));
        });
    }
    async findUnseenByBillingId(billingid) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ billingid })
                .andWhere('isSeen', 0);
        }
        catch (error) {
            logger_1.default.error('Find unseen LoggingCriticalValueAlert by billingid error:', error);
            throw error;
        }
    }
    async findUnseenPaginated(page = 1, pageSize = 10, sortby = 'DESC') {
        try {
            const conn = await this.connection;
            let baseQuery = conn(this.tableName)
                .leftJoin('billing', 'billing.billingid', `${this.tableName}.billingid`)
                .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
                .where('isSeen', 0)
                .andWhere(function () {
                this.whereNotNull('billingid').orWhereNotNull('ascensionid');
            })
                .select(`${this.tableName}.*`, 'new_patients.patientid', 'new_patients.fullpatientid', conn.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) as patient_name"), 'new_patients.designation')
                .orderBy(`${this.tableName}.createdOn`, sortby);
            const totalResultRaw = await baseQuery.clone().count('* as count').first();
            const total = totalResultRaw ? Number(totalResultRaw.count) : 0;
            const rows = await baseQuery.clone().limit(pageSize).offset((page - 1) * pageSize);
            const data = this.mapAlertsWithPatientInfo(rows);
            return {
                data,
                total,
                page,
                pageSize
            };
        }
        catch (error) {
            logger_1.default.error('Find unseen LoggingCriticalValueAlert paginated error:', error);
            throw error;
        }
    }
    async markAsSeen(crkeyId, employeeId) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ crkeyId })
                .update({
                isSeen: 1,
                isSeenBy: employeeId
            });
        }
        catch (error) {
            logger_1.default.error('Error marking alert as seen:', error);
            throw error;
        }
    }
    async createAlert(alertData) {
        try {
            const conn = await this.connection;
            const [result] = await conn(this.tableName)
                .insert({
                billingid: alertData.billingid,
                testid: alertData.testid,
                statement: alertData.statement,
                createdBy: alertData.createdBy,
                isSeen: 0
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Error creating critical value alert:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, pageSize = 20, sortby = 'DESC', filters) {
        try {
            const conn = await this.connection;
            let baseQuery = conn(this.tableName)
                .leftJoin('billing', 'billing.billingid', `${this.tableName}.billingid`)
                .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
                .innerJoin('test_panels', `${this.tableName}.testid`, 'test_panels.id')
                .select(`${this.tableName}.*`, 'test_panels.name as testname', 'new_patients.patientid', 'new_patients.fullpatientid', conn.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) as patient_name"), 'new_patients.designation');
            if (filters) {
                if (filters.testid !== undefined)
                    baseQuery = baseQuery.where('testid', filters.testid);
                if (filters.ascensionid !== undefined)
                    baseQuery = baseQuery.where('ascensionid', filters.ascensionid);
                if (filters.billingid !== undefined)
                    baseQuery = baseQuery.where('billingid', filters.billingid);
                const normalizedSeenFilter = this.normalizeSeenFilter(filters.isSeen);
                if (normalizedSeenFilter !== undefined) {
                    baseQuery = baseQuery.where(`${this.tableName}.isSeen`, normalizedSeenFilter == 1 ? 1 : null);
                }
            }
            baseQuery = baseQuery.orderBy(`${this.tableName}.createdOn`, sortby);
            const totalResultRaw = await baseQuery.clone().count('* as count').first();
            const total = totalResultRaw ? Number(totalResultRaw.count) : 0;
            const rows = await baseQuery
                .clone()
                .limit(pageSize)
                .offset((page - 1) * pageSize);
            const data = this.mapAlertsWithPatientInfo(rows);
            return {
                data,
                total,
                page,
                pageSize
            };
        }
        catch (error) {
            logger_1.default.error('Find all LoggingCriticalValueAlert paginated error:', error);
            throw error;
        }
    }
    async findAll() {
        try {
            const conn = await this.connection;
            return await conn(this.tableName).select('*');
        }
        catch (error) {
            logger_1.default.error('Find all LoggingCriticalValueAlert error:', error);
            throw error;
        }
    }
    async findByTestId(testid) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ testid })
                .andWhere('isSeen', 0);
        }
        catch (error) {
            logger_1.default.error('Error finding alerts by testid:', error);
            throw error;
        }
    }
    async findById(crkeyId) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tableName)
                .where({ crkeyId })
                .first();
            return result || null;
        }
        catch (error) {
            logger_1.default.error('Error finding alert by crkeyId:', error);
            throw error;
        }
    }
    async update(crkeyId, updateData) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ crkeyId })
                .update(updateData);
        }
        catch (error) {
            logger_1.default.error('Error updating alert:', error);
            throw error;
        }
    }
    async delete(crkeyId) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ crkeyId })
                .delete();
        }
        catch (error) {
            logger_1.default.error('Error deleting alert:', error);
            throw error;
        }
    }
}
exports.default = LoggingCriticalValueAlertRepository;
