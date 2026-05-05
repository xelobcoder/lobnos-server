"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ascensionStagingHandler = void 0;
const operations_1 = __importDefault(require("../../models/operations/operations"));
const resultSettings_1 = __importDefault(require("../../models/application/appsettings/resultSettings"));
const testApprovalClass_1 = require("../../models/operations/testApprovalClass");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
async function ascensionStagingHandler(request, response) {
    try {
        const { operationsStaging, dateFrom, dateEnd, grouped, page, patientname, count, isUltrasound, ascensionid, billingid, patientid, employeeid, tenantId, clinicianId, organizationId, testid } = request.query;
        if (!employeeid) {
            return response.send({ status: false, message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, action: 'Include employeeid in the query' });
        }
        const parsedEmployeeId = parseInt(employeeid.toString());
        const tenantIdP = parseInt(tenantId ? tenantId.toString() : '0');
        if (!(await isScientistOrAdmin(parsedEmployeeId, tenantIdP)) && !['ULTRASOUND_COMPLETED', 'ULTRASOUND_UNCOMPLETED'].includes((operationsStaging === null || operationsStaging === void 0 ? void 0 : operationsStaging.toString()) || '')) {
            return response.send({ status: false, message: "You do not have permission to access this resources.Contact administrator for more information" /* OperationsFailures.dontHaveAccessPermission */ });
        }
        if (operationsStaging === "VALIDATION" && !(await canValidateResults(parsedEmployeeId, tenantIdP))) {
            return response.send({ status: false, message: `${"You do not have permission to access this resources.Contact administrator for more information" /* OperationsFailures.dontHaveAccessPermission */}. To validate Result` });
        }
        const queryParams = createQueryParams({
            ascensionid, billingid, patientid,
            patientname,
            testid,
            dateFrom, dateEnd, grouped, operationsStaging, page, count, isUltrasound, clinicianId, organizationId,
            sortby: request.query.sortby
        });
        let list = await operations_1.default.getAscensionBasedOnStage(tenantIdP, queryParams);
        if (operationsStaging === 'VALIDATION' && Array.isArray(list)) {
            list = await filterApprovedAscensionList(list, parsedEmployeeId, tenantIdP);
        }
        if (operationsStaging === "VALIDATED" && Array.isArray(list)) {
            list = await Promise.all(list.map(async (item, index) => {
                return await validatedResultEmployeeGetter(item, tenantIdP);
            }));
        }
        response.send(list);
    }
    catch (err) {
        response.send({ status: false, message: err.message || 'An unexpected error occurred' });
    }
}
exports.ascensionStagingHandler = ascensionStagingHandler;
async function validatedResultEmployeeGetter(item, tenantId) {
    const { department, name, fullname, age, printCount, clientstatus, patientid, billingid, ascensionid, id, fullpatientid, paymentstatus, ascension_date, delivered_by_employeeid, delivered_at, delivered_mode, requested_mode, delivered_by_username } = item;
    const validators = await new testApprovalClass_1.TestApprovalClass(ascensionid).getAscensionAprovedListDetails(tenantId);
    return {
        department, name, fullname, age, printCount, clientstatus, patientid, billingid, validators, testid: id,
        ascensionid, fullpatientid, paymentstatus, ascension_date, delivered_by_employeeid, delivered_at, delivered_mode, requested_mode, delivered_by_username
    };
}
async function isScientistOrAdmin(employeeId, tenantId) {
    return await new user_1.default().getExpectedRole(employeeId, ['scientist', 'admin'], tenantId);
}
async function canValidateResults(employeeId, tenantId) {
    const validationSettings = await resultSettings_1.default.getResultEntrySettings(tenantId);
    return (typeof validationSettings === "object" &&
        Array.isArray(validationSettings.staffQualifiedToValidationResult) &&
        validationSettings.staffQualifiedToValidationResult.includes(employeeId));
}
function createQueryParams({ dateFrom, dateEnd, grouped, operationsStaging, ascensionid, billingid, patientid, testid, patientname, page, count, isUltrasound, sortby, clinicianId, organizationId }) {
    return {
        _dateFrom: dateFrom.toString(),
        _dateEnd: dateEnd.toString(),
        stage: operationsStaging.toString(),
        count: parseInt(count.toString()),
        page: parseInt(page.toString()),
        isUltrasound: isUltrasound === "true",
        sortby: sortby || "DESC",
        clinicianId,
        grouped,
        organizationId,
        ascensionid,
        testid,
        patientname,
        billingid,
        patientid
    };
}
async function filterApprovedAscensionList(list, employeeId, tenantId) {
    const filteredList = await Promise.all(list.map(async (item) => {
        const { ascensionid } = item;
        const ascensionApprovalEmployeeList = await new testApprovalClass_1.TestApprovalClass(ascensionid).getAscensionApprovedList(tenantId);
        return isApproved(employeeId, ascensionApprovalEmployeeList) ? false : item;
    }));
    return filteredList.filter((element) => element);
}
function isApproved(employeeId, approvalList) {
    if (typeof approvalList === 'number') {
        return employeeId == approvalList;
    }
    else if (Array.isArray(approvalList) && approvalList.length > 0) {
        return approvalList.includes(employeeId);
    }
    return false;
}
