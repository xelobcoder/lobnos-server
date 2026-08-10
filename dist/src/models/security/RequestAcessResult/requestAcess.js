"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const creator_1 = __importDefault(require("../../creator/creator"));
const accessWindowsRepo_1 = __importDefault(require("./accessWindowsRepo"));
const resultAcessTableRepo_1 = __importDefault(require("./resultAcessTableRepo"));
const DEFAULT_WINDOW_PERIODS = {
    access: '24h',
    edit: '24h'
};
class RequestAccess {
    static async extractWindowPeriod(tenantId, ascensionid, requestType, staffid) {
        if (!ascensionid)
            throw new Error("Ascension ID is required to extract window period");
        const records = await creator_1.default.getRecordedResultsUsingascensionId(tenantId, ascensionid);
        if (!Array.isArray(records) || records.length === 0 || !records[0])
            return false;
        const record = records[0];
        const timestamp = new Date(record.updated_on || record.created_on || new Date());
        const window = staffid ? await accessWindowsRepo_1.default.getEffectiveSettings(staffid) : await accessWindowsRepo_1.default.findGlobalSettings();
        const windowPeriod = window ? (requestType === 'access' ? window['access_window'] : window["edit_window"]) : DEFAULT_WINDOW_PERIODS[requestType];
        const requireApproval = window ? window.require_approval : false;
        return { windowPeriod, timestamp, record, requireApproval };
    }
    static async verifyWindowPeriod(tenantId, ascensionid, staffid, requestType) {
        const existingRequests = await resultAcessTableRepo_1.default.findLatestByAscensionAndStaff(tenantId, ascensionid, staffid);
        if (existingRequests && existingRequests.status === 'granted') {
            const window = await accessWindowsRepo_1.default.getEffectiveSettings(staffid) || await accessWindowsRepo_1.default.findGlobalSettings();
            const windowPeriod = window ? (requestType === 'access' ? window['access_window'] : window["edit_window"]) : DEFAULT_WINDOW_PERIODS[requestType];
            if (!existingRequests.grantedAt && existingRequests.id) {
                await resultAcessTableRepo_1.default.expireAccess(tenantId, existingRequests.id);
                return false;
            }
            const refinedPeriod = RequestAccess.convertWindowToDate(windowPeriod);
            const grantedTime = new Date(existingRequests.grantedAt).getTime();
            const currentTime = new Date().getTime();
            const expirationTime = grantedTime + refinedPeriod;
            if (expirationTime >= currentTime) {
                if (requestType === 'edit') {
                    const extraction = await RequestAccess.extractWindowPeriod(tenantId, ascensionid, requestType, staffid);
                    if (extraction && typeof extraction !== "boolean") {
                        const { record } = extraction;
                        if (record && record.employeeid && record.employeeid !== existingRequests.staffid && existingRequests.id) {
                            await resultAcessTableRepo_1.default.expireAccess(tenantId, existingRequests.id);
                            return false;
                        }
                    }
                }
                return true;
            }
            else {
                await resultAcessTableRepo_1.default.expireAccess(tenantId, existingRequests.id);
                return false;
            }
        }
        if (!existingRequests) {
            const extraction = await RequestAccess.extractWindowPeriod(tenantId, ascensionid, requestType, staffid);
            if (!extraction || typeof extraction === "boolean")
                return false;
            const { windowPeriod, timestamp } = extraction;
            const refinedPeriod = RequestAccess.convertWindowToDate(windowPeriod);
            const refinedTimestamp = new Date(timestamp).getTime() + refinedPeriod;
            return refinedTimestamp >= new Date().getTime();
        }
        return false;
    }
    static convertWindowToDate(windowPeriod) {
        if (windowPeriod.endsWith('h')) {
            return parseInt(windowPeriod.replace('h', '')) * 60 * 60 * 1000;
        }
        else if (windowPeriod.endsWith('d')) {
            return parseInt(windowPeriod.replace('d', '')) * 24 * 60 * 60 * 1000;
        }
        else if (windowPeriod.endsWith('w')) {
            return parseInt(windowPeriod.replace('w', '')) * 7 * 24 * 60 * 60 * 1000;
        }
        else if (windowPeriod.endsWith('m')) {
            return parseInt(windowPeriod.replace('m', '')) * 30 * 24 * 60 * 60 * 1000;
        }
        else {
            return 24 * 60 * 60 * 1000;
        }
    }
    static async requestPermission(tenantId, request) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const body = {
            patientid: request.patientid,
            staffid: request.staffid,
            requestType: request.requestType,
            ascensionid: request.ascensionid,
            reason: request.reason,
            urgency: request.urgency,
        };
        const [id] = await connection(this.TABLE_NAME).insert(Object.assign(Object.assign({}, body), { requestedAt: new Date(), status: 'pending' }));
        return id;
    }
    static async getAccessHistory(tenantId, patientid, staffid, urgency, count, page, sortby, ascensionid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const query = connection(this.TABLE_NAME)
            .select([
            `${this.TABLE_NAME}.*`,
            'roles.username',
            'roles.email',
            'roles.role as employee_role',
            'new_patients.fullpatientid'
        ])
            .leftJoin('roles', `${this.TABLE_NAME}.staffid`, 'roles.employeeid')
            .leftJoin('new_patients', `${this.TABLE_NAME}.patientid`, 'new_patients.patientid');
        if (patientid)
            query.where(`${this.TABLE_NAME}.patientid`, patientid);
        if (staffid)
            query.where(`${this.TABLE_NAME}.staffid`, staffid);
        if (urgency)
            query.where(`${this.TABLE_NAME}.urgency`, urgency);
        if (ascensionid)
            query.where(`${this.TABLE_NAME}.ascensionid`, ascensionid);
        if (sortby) {
            query.orderBy(`${this.TABLE_NAME}.requestedAt`, sortby);
        }
        if (count && page) {
            query.limit(count).offset((page - 1) * count);
        }
        return await query;
    }
    static async expireExpiredRequests(tenantId) {
        const pendingRequests = await resultAcessTableRepo_1.default.findAll(tenantId, { status: 'pending' });
        for (const request of pendingRequests) {
            const isValid = await RequestAccess.verifyWindowPeriod(tenantId, request.ascensionid, request.staffid, request.requestType);
            if (!isValid && request.id) {
                await resultAcessTableRepo_1.default.expireAccess(tenantId, request.id);
            }
        }
        const grantedRequests = await resultAcessTableRepo_1.default.findAll(tenantId, { status: 'granted' });
        for (const request of grantedRequests) {
            const isValid = await RequestAccess.verifyWindowPeriod(tenantId, request.ascensionid, request.staffid, request.requestType);
            if (!isValid && request.id) {
                await resultAcessTableRepo_1.default.expireAccess(tenantId, request.id);
            }
        }
    }
}
RequestAccess.TABLE_NAME = 'result_access_requests';
exports.default = RequestAccess;
