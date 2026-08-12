"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResultDeliveryChain = exports.recordResultHandover = exports.recordResultDelivery = exports.getResultRecordUndelivered = exports.getResultDeliveryPreference = exports.setResultDeliveryPreference = exports.completeFlowByPassMultipleHandler = exports.completeFlowByPassHandler = exports.getTestCreationRule = exports.getResultPrintMultipleHandler = exports.getResultPrintoutHandler = exports.CheckPaymentStatus = exports.resultEntryDrugsHandler = exports.criticalValuesUnseenHandler = exports.testCreationRuleUpdateHandler = exports.getResultCommentsHandler = exports.getPreviousResultEntryRecordsIfAny = exports.resultEntry = void 0;
const resultSettings_1 = __importDefault(require("../../models/application/appsettings/result-settings/resultSettings"));
const companyProfile_1 = require("../../models/settings/companyProfile");
const registration_1 = __importDefault(require("../../models/registration/registration"));
// import TestSetup from '../../../api/models/testSetup.model'
const resultPrint_1 = __importDefault(require("../../models/result/resultPrint"));
const ascension_1 = require("../../models/operations/ascension");
const helper_1 = require("../../hooks/helper");
const literature_1 = __importDefault(require("../../testpanel/literature"));
const resultEncryptionReferer_1 = __importDefault(require("../../models/creator/resultEncryptionReferer"));
const creator_1 = __importDefault(require("../../models/creator/creator"));
const billing_1 = require("../../../obso/billing");
const TestCreationRulesRepository_1 = __importDefault(require("../../models/TestCreation/TestCreationRulesRepository"));
const RolesRepository_1 = __importDefault(require("../../models/settings/users/RolesRepository"));
const requestAcess_1 = __importDefault(require("../../models/security/RequestAcessResult/requestAcess"));
const services_1 = require("../../models/services/services");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const resultDelivery_1 = __importDefault(require("./resultDelivery"));
const NotificationDispatcher_1 = require("../../models/application/notifications/services/NotificationDispatcher");
const loggingCriticalValueAlertRepository_1 = __importDefault(require("../../models/creator/Repo/loggingCriticalValueAlertRepository"));
// export const getPatientTestTrend = async (req: Request, res: IResponse): Promise<void> => {
//   const { patientid, testid, test, instances } = req.query;
//   try {
//     const result = await new Patient(patientid).getPatientTestTrend(patientid, testid, test, instances);
//     res.send({ statusCode: 200, status: "success", result });
//   } catch (err) {
//     logger.error(err);
//     customError("Error occurred", 500, res);
//   }
// };
const resultEntry = async (req, response) => {
    try {
        const { tenantId } = req.query;
        const { testid } = req.body;
        if (isNaN(testid))
            return (0, helper_1.customError)("testid must be a number", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const isDataInserted = await new creator_1.default(testid).resultEntry(tenantIdP, req.body);
        if (isDataInserted == true) {
            const body = req.body;
            const ascensionId = (body === null || body === void 0 ? void 0 : body.ascensionid) || (body === null || body === void 0 ? void 0 : body.ascensionId);
            const actorId = (body === null || body === void 0 ? void 0 : body.employeeid) ? Number(body.employeeid) : undefined;
            if (ascensionId) {
                const refs = { ascensionId: Number(ascensionId) };
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantIdP, 'RESULT_PROCESSING', refs, actorId).catch(() => { });
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantIdP, 'RESULT_PENDING_VERIFICATION', refs, actorId).catch(() => { });
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantIdP, 'RESULT_READY', refs, actorId).catch(() => { });
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantIdP, 'REPORT_READY', refs, actorId).catch(() => { });
            }
            response.send({ status: "success", statusCode: 200, message: "records updated successfully" });
        }
        else {
            response.send({ status: "failed", statusCode: 404, message: "error occured saving results" });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
};
exports.resultEntry = resultEntry;
const getPreviousResultEntryRecordsIfAny = async function (request, response) {
    try {
        const { csvid, ptid, testid, target = '70,50', tenantId } = request.query;
        if (!csvid || !ptid)
            return (0, helper_1.customError)("required params are missing", 400, response);
        const parsedTestId = parseInt(testid.toString());
        const rule = new creator_1.default(parsedTestId);
        const tenantIdP = parseInt(tenantId.toString());
        const { billingid, patientid } = rule.sanitize_patientid_billingid_query(csvid, ptid, target);
        if (patientid && billingid && testid) {
            const records = await rule.getResultEntryRecords(tenantIdP, parsedTestId, billingid, patientid);
            if (typeof records !== "string") {
                let result = records === null || records === void 0 ? void 0 : records.result;
                const decryptedResult = await (0, resultEncryptionReferer_1.default)(result, "decryption");
                if (decryptedResult != undefined) {
                    const resultDeliveryPreference = await new resultDelivery_1.default(billingid, tenantIdP).getResultDeliveryForTransaction();
                    const { resources } = decryptedResult;
                    if (resources && Array.isArray(resources) && resources.length > 0) {
                        result = result.map((item, index) => {
                            return Object.assign(Object.assign({}, item), { value: resources[index]['value'] });
                        });
                        return response.send(Object.assign(Object.assign({}, records), { result, resultDeliveryPreference }));
                    }
                }
                return response.send(records);
            }
            else {
                response.send({ records: null });
            }
        }
        response.send([]);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getPreviousResultEntryRecordsIfAny = getPreviousResultEntryRecordsIfAny;
const getResultCommentsHandler = async function (request, response) {
    try {
        const { csvid, testid, ptid, tenantId } = request.query;
        if (!csvid || !testid || !ptid) {
            return (0, helper_1.customError)("testid,patientid and billingid are required", 404, response);
        }
        const tenantIdP = parseInt(tenantId.toString());
        const parsedTestid = parseInt(testid.toString());
        const creator = new creator_1.default(parsedTestid);
        const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, '70,50');
        const parsedBillingid = parseInt(billingid.toString());
        const comments = await creator.getCustomCommentsRecords(tenantIdP, parsedBillingid, parsedTestid);
        response.send({ comments });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getResultCommentsHandler = getResultCommentsHandler;
const testCreationRuleUpdateHandler = async (request, response) => {
    try {
        const { testid, data } = request.body;
        const { tenantId } = request.query;
        const parsedTestId = parseInt(testid.toString());
        if (!testid || !data)
            return (0, helper_1.customError)("testid  && data is required", 404, response);
        if (data.length === 0)
            return (0, helper_1.customError)("wrong format provided", 404, response);
        const tenantIdP = parseInt(tenantId.toString());
        const createFields = await new TestCreationRulesRepository_1.default(tenantIdP).create(data, parsedTestId);
        const status = createFields.length > 0 ? true : false;
        response.send({ status, message: status ? "fields created successfully" : "error occured creating fields" });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.testCreationRuleUpdateHandler = testCreationRuleUpdateHandler;
const criticalValuesUnseenHandler = async (request, response) => {
    try {
        const { count, page, tenantId } = request.query;
        if (!tenantId) {
            return response.status(400).send({ error: 'tenantId is required' });
        }
        const tenantIdP = parseInt(tenantId.toString());
        const parsedCount = parseInt((count === null || count === void 0 ? void 0 : count.toString()) || '10');
        const parsedPage = parseInt((page === null || page === void 0 ? void 0 : page.toString()) || '1');
        const sortby = request.query.sortby === 'ASC' ? 'ASC' : 'DESC';
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantIdP);
        const result = await repo.findUnseenPaginated(parsedPage, parsedCount, sortby);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.criticalValuesUnseenHandler = criticalValuesUnseenHandler;
const resultEntryDrugsHandler = async (request, response) => {
    try {
        const { ascensionid, testid, tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const parsedAscensionid = parseFloat(ascensionid.toString());
        const parsedTestid = parseFloat(testid.toString());
        const drugsList = await ascension_1.TestAscension.getAscensionSavedDrugs(tenantIdP, parsedAscensionid, parsedTestid);
        response.send(drugsList);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.resultEntryDrugsHandler = resultEntryDrugsHandler;
const CheckPaymentStatus = async (request, response, next) => {
    const { ascensionId, tenantId } = request.query;
    try {
        const tenantIdP = parseInt(tenantId.toString());
        const numAscensionId = parseInt(ascensionId.toString());
        const isPaymentStatusValid = await new creator_1.default(0).CheckPaymentStatus(tenantIdP, numAscensionId);
        if (!isPaymentStatusValid) {
            return (0, helper_1.customError)("Cannot Print Result For Unpaid Service or test", 403, response);
        }
        else {
            next();
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
};
exports.CheckPaymentStatus = CheckPaymentStatus;
const getResultPrintoutHandler = async (request, response) => {
    try {
        // check if access to view is allowed
        const { ascensionId, testid, csvid, ptid, target, isScan = false, tenantId, employeeid, isBrowserPrintout } = request.query;
        const browserMode = isBrowserPrintout == "1" || isBrowserPrintout == 1 || isBrowserPrintout == "true" ? true : false;
        const tenantIdP = parseInt(tenantId.toString());
        let isWithinWindow = false;
        if (!ascensionId)
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + ". ascensionid not provided", 404, response);
        const numAscensionId = parseInt(ascensionId.toString());
        const userRole = await new RolesRepository_1.default(tenantIdP).getRoleById(parseInt(employeeid.toString()));
        if (userRole && ['admin', 'manager', 'super-admin'].includes(userRole.role.toLowerCase()) == false) {
            isWithinWindow = await requestAcess_1.default.verifyWindowPeriod(tenantIdP, ascensionId, parseInt(employeeid), "access");
        }
        else {
            isWithinWindow = true;
        }
        if (!isWithinWindow) {
            return (0, helper_1.customError)("Access window period has expired." /* OperationsFailures.accessWindowExpired */, 403, response);
        }
        const resultApproved = await resultSettings_1.default.isApprovalLimitReached(tenantIdP, null, numAscensionId, "minimum");
        if (!resultApproved && !isScan) {
            return response.send({ message: "Mininum result approval not reached" /* OperationsFailures.minimumResultValidation */ });
        }
        const parsedTestId = parseInt(testid.toString());
        let creator = new creator_1.default(parsedTestId);
        const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, target);
        const dataset = {
            resultsettings: null,
            records: [],
            companyInfo: null,
            patientInformation: null,
            comments: null,
            testname: '',
            validators: [],
            hasDrugs: false,
            patientid,
            billingid,
            lastupdatedon: null,
            logourl: '',
            enteredOn: null,
            samplingInformation: null,
            resultentry: null,
            literatureReview: null,
            testInfo: null,
            testdetailcategory: null,
        };
        const resultsettings = await new resultSettings_1.default(tenantIdP).getResultSettings(tenantIdP);
        if (typeof resultsettings != "boolean")
            dataset.resultsettings = resultsettings;
        const companyInfo = await (0, companyProfile_1.getAllCompanyProfiles)(tenantIdP);
        if (companyInfo != null)
            dataset.companyInfo = companyInfo;
        const intPatientid = parseInt(patientid.toString());
        const patientInformation = await new registration_1.default().getPatientBasicData(tenantIdP, intPatientid);
        if (patientInformation != null) {
            dataset.patientInformation = patientInformation;
        }
        const comments = await creator.getCustomCommentsRecords(tenantIdP, billingid, parsedTestId);
        dataset.comments = comments;
        const literatureReview = await new literature_1.default("").getResultLiterature(tenantIdP, testid);
        if (literatureReview.can != false) {
            dataset.literatureReview = literatureReview.literature;
        }
        let records = await new creator_1.default(testid).resultPresentationView(tenantIdP, parsedTestId, billingid, patientid);
        if (browserMode && typeof records != "string" && records.result && Array.isArray(records.result)) {
            records.result = await resultPrint_1.default.decryptResultArray(records.result);
        }
        if (records != null && typeof records != "string" && !Array.isArray(records)) {
            const { result, testname, hasDrugs, testInfo, testdetailcategory } = records;
            // Sort result in ascending order by 'ordering' property if present
            if (Array.isArray(result) && result.length > 0 && result[0].hasOwnProperty('ordering')) {
                dataset.records = [...result].sort((a, b) => { var _a, _b; return ((_a = a.ordering) !== null && _a !== void 0 ? _a : 0) - ((_b = b.ordering) !== null && _b !== void 0 ? _b : 0); });
            }
            else {
                dataset.records = result;
            }
            dataset.testname = testname;
            dataset.hasDrugs = hasDrugs;
            dataset.testInfo = testInfo || null;
            dataset.testdetailcategory = testdetailcategory || null;
        }
        if (dataset.hasDrugs == true) {
            const drugList = await ascension_1.TestAscension.getAscensionSavedDrugs(tenantIdP, numAscensionId, parsedTestId);
            if (Array.isArray(drugList) && drugList.length > 0) {
                dataset.drugList = drugList.filter((drug) => {
                    return ['Resistant', 'Sensitive'].includes(drug.sensitivity);
                });
            }
            else {
                dataset.drugList = drugList;
            }
        }
        let samplingInformation = await ascension_1.TestAscension.findAscension(tenantIdP, numAscensionId);
        if (samplingInformation != null) {
            dataset.samplingInformation = samplingInformation;
        }
        // Get referrer facility information from services table
        const referrerFacility = await services_1.Services.getRefererFacilityByBillingId(tenantIdP, billingid);
        if (referrerFacility) {
            dataset.referrerFacility = referrerFacility;
        }
        let resultEntry = await new resultPrint_1.default(billingid).getResultEntryScientist(tenantIdP, billingid, parsedTestId, numAscensionId);
        const { validators, resultentry, lastupdatedon, enteredOn } = resultEntry;
        dataset.validators = validators;
        dataset.lastupdatedon = lastupdatedon || null;
        dataset.resultentry = resultentry;
        const hostname = process.env.NODE_ENV === 'development'
            ? process.env.APPHOST_DEVELOPMENT + ':' + process.env.DEVELOPMENT_PORT
            : process.env.APPHOST_PRODUCTION + ':' + process.env.PRODUCTION_PORT;
        dataset.logourl = `http://${hostname}/api/v1/settings/companyprofile/images`;
        dataset.enteredOn = enteredOn || null;
        if (employeeid) {
            const pEmployeeId = parseInt(employeeid.toString());
            const employeedata = await new RolesRepository_1.default(tenantIdP).getRoleById(pEmployeeId);
            const { username, role, mobile } = employeedata;
            dataset.generalValidation = {
                employeeid: pEmployeeId,
                username,
                role,
                mobile
            };
        }
        response.send(dataset);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getResultPrintoutHandler = getResultPrintoutHandler;
const getResultPrintMultipleHandler = async (request, response) => {
    try {
        const { csvid, ptid, target, isUltrasoundInclusive = false, tenantId, isBrowserPrintout, employeeid } = request.query;
        const browserMode = isBrowserPrintout == "1" || isBrowserPrintout == 1 || isBrowserPrintout == "true" ? true : false;
        const tenantIdP = parseInt(tenantId.toString());
        const pEmployeeId = parseInt(employeeid.toString());
        if (!employeeid || isNaN(pEmployeeId))
            return (0, helper_1.customError)("User Not recognized", 404, response);
        let creator = new creator_1.default(0);
        const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, target);
        if (patientid && billingid) {
            const isvalidBillingid = await billing_1.Billing.checkValidityOfBillingid(tenantIdP, billingid);
            if (!isvalidBillingid)
                return response.send({ status: false, message: "Resource not found." /* OperationsFailures.notFound */ });
            const billingAscensions = await ascension_1.TestAscension.findAllBillingAssociatedTestAscensions(tenantIdP, billingid, false);
            if (billingAscensions.length === 0)
                return response.send({ status: false, message: 'No result Associated with billingid' });
            let qualifiedForPrintOut = await Promise.all(billingAscensions.map(async (ascensionItem, index) => {
                const { id, testid } = ascensionItem;
                const resultApproved = await resultSettings_1.default.isApprovalLimitReached(tenantIdP, null, id, "minimum");
                return resultApproved ? { ascensionid: id, testid } : null;
            }));
            qualifiedForPrintOut = qualifiedForPrintOut.filter((item) => item === null || item === void 0 ? void 0 : item.ascensionid);
            // check each for acess window or acess permission allowed
            let accessPermissionTest = [];
            const currentRole = await new RolesRepository_1.default(tenantIdP).getRoleById(pEmployeeId);
            const isPriviledgedUser = currentRole && ['admin', 'manager', 'super-admin'].includes(currentRole.role.toLowerCase());
            for (let i = 0; i < qualifiedForPrintOut.length; i++) {
                const item = qualifiedForPrintOut[i];
                if (!item)
                    continue;
                let isWithinWindow = false;
                if (isPriviledgedUser) {
                    isWithinWindow = true;
                }
                else {
                    const ascensionid = item.ascensionid ? parseInt(item.ascensionid.toString()) : 0;
                    isWithinWindow = await requestAcess_1.default.verifyWindowPeriod(tenantIdP, ascensionid, pEmployeeId, "access");
                }
                isWithinWindow ? accessPermissionTest.push(item) : null;
            }
            if (accessPermissionTest.length == 0) {
                throw new Error("Access window period has expired." /* OperationsFailures.accessWindowExpired */);
            }
            qualifiedForPrintOut = accessPermissionTest;
            if (qualifiedForPrintOut.length > 0) {
                const finalResult = {
                    test: [],
                    generalValidation: null,
                    resultsettings: null,
                    companyInfo: null,
                    patientInformation: null,
                    patientid: null,
                    billingid: null,
                    logourl: null,
                    generalComments: ''
                };
                finalResult.test = await Promise.all(qualifiedForPrintOut.map(async (item, index) => {
                    const { testid, ascensionid } = item;
                    let dataset = {
                        literatureReview: null,
                        records: null,
                        testname: '',
                        hasDrugs: false,
                        drugList: [],
                        validators: [],
                        lastupdatedon: '',
                        resultentry: '',
                        comments: '',
                        testInfo: null,
                        testdetailcategory: null,
                        referrerFacility: null,
                    };
                    const literatureReview = await new literature_1.default('').getResultLiterature(tenantIdP, testid);
                    if (literatureReview.can != false) {
                        dataset.literatureReview = literatureReview.literature;
                    }
                    let resultEntry = await new resultPrint_1.default(billingid).getResultEntryScientist(tenantIdP, billingid, item.testid, item.ascensionid);
                    const { validators, resultentry, lastupdatedon, enteredOn } = resultEntry;
                    dataset.validators = validators;
                    dataset.resultentry = resultentry;
                    dataset.lastupdatedon = enteredOn || lastupdatedon;
                    const records = await new creator_1.default(testid).resultPresentationView(tenantIdP, testid, billingid, patientid);
                    if (records != null && typeof records != "string") {
                        const { result, testname, hasDrugs, testInfo, testdetailcategory } = records;
                        dataset.records = result;
                        if (browserMode && typeof records != "string" && records.result && Array.isArray(records.result)) {
                            dataset.records = await resultPrint_1.default.decryptResultArray(records.result);
                        }
                        dataset.testname = testname;
                        dataset.hasDrugs = hasDrugs;
                        dataset.testInfo = testInfo || null;
                        dataset.testdetailcategory = testdetailcategory || null;
                    }
                    if (dataset.hasDrugs == true) {
                        const drugList = await ascension_1.TestAscension.getAscensionSavedDrugs(tenantIdP, ascensionid, testid);
                        if (Array.isArray(drugList) && drugList.length > 0) {
                            dataset.drugList = drugList.filter((drug) => {
                                return ['Resistant', 'Sensitive'].includes(drug.sensitivity);
                            });
                        }
                        else {
                            dataset.drugList = drugList;
                        }
                    }
                    // Get referrer facility information from services table
                    const referrerFacility = await services_1.Services.getRefererFacilityByBillingId(tenantIdP, billingid);
                    if (referrerFacility) {
                        dataset.referrerFacility = referrerFacility;
                    }
                    const comments = await creator.getCustomCommentsRecords(tenantIdP, billingid, testid);
                    if (typeof dataset.comments === "string" && typeof comments === "string") {
                        finalResult.generalComments = finalResult.generalComments + " " + comments;
                    }
                    return dataset;
                }));
                const resultsettings = await new resultSettings_1.default(0).getResultSettings(tenantIdP);
                if (typeof resultsettings != "boolean") {
                    finalResult.resultsettings = resultsettings;
                }
                const companyInfo = await (0, companyProfile_1.getAllCompanyProfiles)(tenantIdP);
                if (companyInfo != null) {
                    finalResult.companyInfo = companyInfo;
                }
                const intPatientid = parseInt(patientid.toString());
                finalResult.patientInformation = await new registration_1.default().getPatientBasicData(tenantIdP, intPatientid);
                finalResult.patientid = patientid;
                finalResult.billingid = billingid;
                const hostname = process.env.NODE_ENV === 'development'
                    ? process.env.APPHOST_DEVELOPMENT + ':' + process.env.DEVELOPMENT_PORT
                    : process.env.APPHOST_PRODUCTION + ':' + process.env.PRODUCTION_PORT;
                finalResult.logourl = `http://${hostname}/api/v1/settings/companyprofile/images`;
                if (employeeid) {
                    const employeedata = await new RolesRepository_1.default(tenantIdP).getRoleById(pEmployeeId);
                    const { employeeid, username, role, mobile } = employeedata;
                    finalResult.generalValidation = {
                        employeeid,
                        username,
                        role,
                        mobile
                    };
                }
                return response.send(finalResult);
            }
        }
        return response.send({ status: false, message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ });
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        (0, helper_1.responseError)(response, errorMessage);
    }
};
exports.getResultPrintMultipleHandler = getResultPrintMultipleHandler;
const getTestCreationRule = async (request, response) => {
    try {
        const { tenantId } = request.query;
        const testid = request.params.testid;
        if (!testid || !tenantId) {
            return (0, helper_1.customError)("testid and tenantId are required", 400, response);
        }
        const parsedTestId = parseInt(testid.toString());
        const parsedTenantId = parseInt(tenantId.toString());
        const repository = new TestCreationRulesRepository_1.default(parsedTenantId);
        const rules = await repository.findByTestId(parsedTestId);
        if (!rules || rules.length === 0) {
            return response.json({
                status: false,
                message: "No test creation rules found"
            });
        }
        return response.json({
            status: true,
            data: rules
        });
    }
    catch (error) {
        return (0, helper_1.responseError)(response);
    }
};
exports.getTestCreationRule = getTestCreationRule;
const completeFlowByPassHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeId = req.body.employeeid;
        const billingid = req.body.billingid;
        if (!billingid || !employeeId) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameters: billingid, employeeid, tenantId' });
        }
        const result = await ascension_1.TestAscension.completeFlowByPass(tenantId, parseInt(billingid), parseInt(employeeId));
        res.send({ status: result == true ? 'success' : 'error', message: result == true ? 'Operation completed successfully' : 'Operation failed' });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};
exports.completeFlowByPassHandler = completeFlowByPassHandler;
const completeFlowByPassMultipleHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeId = req.body.employeeid;
        const billingids = req.body.billingIds;
        if (!billingids || !employeeId || !Array.isArray(billingids) || billingids.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameters: billingids (array), employeeid, tenantId' });
        }
        const result = await ascension_1.TestAscension.completeFlowByPassMultiple(tenantId, billingids, parseInt(employeeId));
        res.send({ status: result == true ? 'success' : 'error', message: result == true ? 'Operation completed successfully' : 'Operation failed' });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};
exports.completeFlowByPassMultipleHandler = completeFlowByPassMultipleHandler;
const setResultDeliveryPreference = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { billingid, preferences, employeeid } = req.body || {};
        const pBillingId = parseInt(String(billingid), 10);
        if (!pBillingId || isNaN(pBillingId)) {
            return (0, helper_1.customError)("billingid must be a number", 400, res);
        }
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const billing = await conn('billing').select('patientid').where({ billingid: pBillingId }).first();
        if (!billing || !billing.patientid) {
            return (0, helper_1.customError)("billing record not found", 404, res);
        }
        // Handle new format with preferences array (test-specific)
        if (preferences && Array.isArray(preferences) && preferences.length > 0) {
            const testPreferences = preferences.map((pref) => {
                var _a, _b, _c;
                return ({
                    billingid: pBillingId,
                    ascensionid: pref.ascensionid,
                    patientid: billing.patientid,
                    requested_mode: (pref.requested_mode || '').trim().toLowerCase(),
                    requested_mode_detail: (_a = pref.requested_mode_detail) !== null && _a !== void 0 ? _a : null,
                    updated_by_employeeid: (_c = (_b = pref.employeeid) !== null && _b !== void 0 ? _b : employeeid) !== null && _c !== void 0 ? _c : null
                });
            });
            // Validate each preference has testid and requested_mode
            for (const pref of testPreferences) {
                if (!pref.ascensionid || isNaN(parseInt(String(pref.ascensionid)))) {
                    return (0, helper_1.customError)("Each preference must have a valid ascensionid", 400, res);
                }
                if (!pref.requested_mode) {
                    return (0, helper_1.customError)("Each preference must have a requested_mode", 400, res);
                }
            }
            const status = await new resultDelivery_1.default(pBillingId, tenantId).setMultipleTestResultDeliveryPreferences(testPreferences);
            return res.send({ status, message: `Updated ${testPreferences.length} test preference(s)` });
        }
        // Legacy format: single billing-level preference
        const { requested_mode, requested_mode_detail } = req.body || {};
        if (!requested_mode || typeof requested_mode !== 'string') {
            return (0, helper_1.customError)("requested_mode is required", 400, res);
        }
        const payload = {
            billingid: pBillingId,
            patientid: billing.patientid,
            requested_mode: requested_mode.trim().toLowerCase(),
            requested_mode_detail: requested_mode_detail !== null && requested_mode_detail !== void 0 ? requested_mode_detail : null,
            updated_by_employeeid: employeeid !== null && employeeid !== void 0 ? employeeid : null,
            updated_at: conn.fn.now()
        };
        const status = await new resultDelivery_1.default(pBillingId, tenantId).setResultDeliveryPreference(payload);
        res.send({ status });
    }
    catch (err) {
        (0, helper_1.responseError)(res, err);
    }
};
exports.setResultDeliveryPreference = setResultDeliveryPreference;
const getResultDeliveryPreference = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const billingid = parseInt(String(req.params.billingid || req.query.billingid), 10);
        if (!billingid || isNaN(billingid)) {
            return (0, helper_1.customError)("billingid must be a number", 400, res);
        }
        const deliveryPrefs = await new resultDelivery_1.default(billingid, tenantId).getAllResultDeliveryPreferencesForTransaction();
        res.send({
            status: true,
            preferences: deliveryPrefs || []
        });
    }
    catch (err) {
        (0, helper_1.responseError)(res, err);
    }
};
exports.getResultDeliveryPreference = getResultDeliveryPreference;
const getResultRecordUndelivered = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const count = req.query.count ? parseInt(req.query.count, 10) : 0;
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const undeliveredRecords = await new resultDelivery_1.default(0, tenantId).getResultsUndelivered(startDate, endDate, page, count);
        res.send({
            status: true,
            records: undeliveredRecords || []
        });
    }
    catch (err) {
        (0, helper_1.responseError)(res, err);
    }
};
exports.getResultRecordUndelivered = getResultRecordUndelivered;
const recordResultDelivery = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { billingid, ascensionid, delivered_mode, delivered_by_employeeid, notes, failurenotes } = req.body || {};
        const pBillingId = parseInt(String(billingid), 10);
        const pAscensionId = ascensionid !== undefined && ascensionid !== null ? parseInt(String(ascensionid), 10) : null;
        const pEmployeeId = parseInt(String(delivered_by_employeeid), 10);
        if (!pBillingId || isNaN(pBillingId))
            return (0, helper_1.customError)("billingid must be a number", 400, res);
        if (pAscensionId !== null && isNaN(pAscensionId))
            return (0, helper_1.customError)("ascensionid must be a number", 400, res);
        if (!pEmployeeId || isNaN(pEmployeeId)) {
            return (0, helper_1.customError)("delivered_by_employeeid must be a number", 400, res);
        }
        if ((!delivered_mode || typeof delivered_mode !== 'string') && (!failurenotes || typeof failurenotes !== 'string')) {
            return (0, helper_1.customError)("either delivered_mode or failurenotes is required", 400, res);
        }
        const normalizedDeliveredMode = delivered_mode && typeof delivered_mode === 'string'
            ? delivered_mode.trim().toLowerCase()
            : null;
        const result = await new resultDelivery_1.default(pBillingId, tenantId).updateResultDeliveryLog({
            ascensionid: pAscensionId,
            billingid: pBillingId,
            delivered_mode: failurenotes ? null : normalizedDeliveredMode,
            delivered_by_employeeid: pEmployeeId,
            notes: notes !== null && notes !== void 0 ? notes : null,
            failurenotes: failurenotes !== null && failurenotes !== void 0 ? failurenotes : null
        });
        if (result && normalizedDeliveredMode) {
            const refs = {
                billingId: pBillingId,
                ascensionId: pAscensionId !== null && pAscensionId !== void 0 ? pAscensionId : undefined,
            };
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'RESULT_RELEASED', refs, pEmployeeId).catch(() => { });
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'REPORT_RELEASED', refs, pEmployeeId).catch(() => { });
        }
        res.status(201).send({ status: true, result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res, err);
    }
};
exports.recordResultDelivery = recordResultDelivery;
const recordResultHandover = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { billingid, from_employeeid, to_employeeid, status, notes } = req.body || {};
        const pBillingId = parseInt(String(billingid), 10);
        const pFrom = parseInt(String(from_employeeid), 10);
        const pTo = parseInt(String(to_employeeid), 10);
        if (!pBillingId || isNaN(pBillingId) || !pFrom || isNaN(pFrom) || !pTo || isNaN(pTo)) {
            return (0, helper_1.customError)("billingid, from_employeeid and to_employeeid must be numbers", 400, res);
        }
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const billing = await conn('billing').select('patientid').where({ billingid: pBillingId }).first();
        const patientid = billing && billing.patientid ? billing.patientid : null;
        const [id] = await conn('result_handover_log').insert({
            billingid: pBillingId,
            patientid,
            from_employeeid: pFrom,
            to_employeeid: pTo,
            status: status ? String(status).trim().toLowerCase() : 'handover',
            notes: notes !== null && notes !== void 0 ? notes : null,
            created_at: conn.fn.now()
        });
        res.status(201).send({ status: true, id });
    }
    catch (err) {
        (0, helper_1.responseError)(res, err);
    }
};
exports.recordResultHandover = recordResultHandover;
const getResultDeliveryChain = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const billingid = parseInt(String(req.params.billingid), 10);
        if (!billingid || isNaN(billingid))
            return (0, helper_1.customError)("billingid must be a number", 400, res);
        const deliveryChain = await new resultDelivery_1.default(billingid, tenantId).getResultDeliveryChain();
        if (deliveryChain && deliveryChain.status === true)
            return res.send(deliveryChain);
        return res.send({ status: false, message: "No delivery chain found" });
    }
    catch (err) {
        (0, helper_1.responseError)(res, err);
    }
};
exports.getResultDeliveryChain = getResultDeliveryChain;
