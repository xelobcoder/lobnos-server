"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeFlowByPassMultipleHandler = exports.completeFlowByPassHandler = exports.getTestCreationRule = exports.sendResultViaEmailHandler = exports.getResultPrintMultipleHandler = exports.getResultPrintoutHandler = exports.resultEntryDrugsHandler = exports.criticalValuesUnseenHandler = exports.testCreationRuleUpdateHandler = exports.getResultCommentsHandler = exports.getPreviousResultEntryRecordsIfAny = exports.resultEntry = void 0;
const resultSettings_1 = __importDefault(require("../../models/application/appsettings/resultSettings"));
const companyProfile_1 = require("../../models/settings/companyProfile");
const registration_1 = __importDefault(require("../../models/registration/registration"));
// import TestSetup from '../../../api/models/testSetup.model'
const resultPrint_1 = __importDefault(require("../../models/result/resultPrint"));
const ascension_1 = require("../../models/operations/ascension");
const helper_1 = require("../../hooks/helper");
const literature_1 = __importDefault(require("../../testpanel/literature"));
const resultEncryptionReferer_1 = __importDefault(require("../../models/creator/resultEncryptionReferer"));
const creator_1 = __importDefault(require("../../models/creator/creator"));
const billing_1 = require("../../models/billing/billing");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const core_1 = __importDefault(require("../../EmailServices/core"));
const TestCreationRulesRepository_1 = __importDefault(require("../../models/TestCreation/TestCreationRulesRepository"));
const RolesRepository_1 = __importDefault(require("../../models/settings/users/RolesRepository"));
const requestAcess_1 = __importDefault(require("../../models/security/RequestAcessResult/requestAcess"));
const services_1 = require("../../models/services/services");
// export const getPatientTestTrend = async (req: IRequest, res: IResponse): Promise<void> => {
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
                    const { resources } = decryptedResult;
                    if (resources && Array.isArray(resources) && resources.length > 0) {
                        result = result.map((item, index) => {
                            return Object.assign(Object.assign({}, item), { value: resources[index]['value'] });
                        });
                        return response.send(Object.assign(Object.assign({}, records), { result }));
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
        console.log(err);
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
        console.log(err);
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
        const tenantIdP = parseInt(tenantId.toString());
        const parsedCount = parseInt(count.toString());
        const parsedPage = parseInt(page.toString());
        // const unSeenArray = await TrackValuesAlertClass.getUnviewedTracksAlert(tenantIdP, parsedCount, parsedPage);
        // response.send(unSeenArray);
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
        const resultsettings = await new resultSettings_1.default(null).getResultSettings(tenantIdP);
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
        const literatureReview = await new literature_1.default(null).getResultLiterature(tenantIdP, testid);
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
        dataset.lastupdatedon = lastupdatedon;
        dataset.resultentry = resultentry;
        const hostname = process.env.NODE_ENV === 'development'
            ? process.env.APPHOST_DEVELOPMENT + ':' + process.env.DEVELOPMENT_PORT
            : process.env.APPHOST_PRODUCTION + ':' + process.env.PRODUCTION_PORT;
        dataset.logourl = `http://${hostname}/api/v1/settings/companyprofile/images`;
        dataset.enteredOn = enteredOn;
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
        console.log(err);
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
        let creator = new creator_1.default(null);
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
                let isWithinWindow = false;
                if (isPriviledgedUser) {
                    isWithinWindow = true;
                }
                else {
                    isWithinWindow = await requestAcess_1.default.verifyWindowPeriod(tenantIdP, qualifiedForPrintOut[i].ascensionid, pEmployeeId, "access");
                }
                isWithinWindow ? accessPermissionTest.push(qualifiedForPrintOut[i]) : null;
            }
            if (accessPermissionTest.length == 0) {
                throw new Error("Access window period has expired." /* OperationsFailures.accessWindowExpired */);
            }
            qualifiedForPrintOut = accessPermissionTest;
            if (qualifiedForPrintOut.length > 0) {
                const finalResult = {
                    test: null,
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
                    const literatureReview = await new literature_1.default(null).getResultLiterature(tenantIdP, testid);
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
                    if (typeof dataset.comments === "string") {
                        finalResult.generalComments = finalResult.generalComments + " " + dataset.comments;
                    }
                    return dataset;
                }));
                const resultsettings = await new resultSettings_1.default(null).getResultSettings(tenantIdP);
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
const sendResultViaEmailHandler = async (request, response) => {
    try {
        const { csvid, ptid, target, testid, tenantId } = request.query;
        const { billingid, patientid } = new creator_1.default(parseInt(testid.toString())).sanitize_patientid_billingid_query(csvid, ptid, target);
        const tenantIdP = parseInt(tenantId.toString());
        const patientData = await registration_1.default.getPatientDataUsingPatientId(tenantIdP, patientid);
        if (!patientData || !patientData['email']) {
            return response.status(400).json({ status: false, message: 'Email Not Found For user' });
        }
        const query = new URLSearchParams(request.query);
        const url = `${process.env.PDFGENERATOR_CHANNEL_ENDPOINT}/result/pdf/generate?${query.toString()}&&is_password_encrypted=true&&password=TiifuHamza`;
        const fileResponse = await fetch(url);
        if (!fileResponse.ok) {
            throw new Error(`Failed to fetch PDF: ${fileResponse.statusText}`);
        }
        const fileTempDir = path_1.default.join(__dirname, '../../../views/result');
        const fileTempPath = path_1.default.join(fileTempDir, 'result.pdf');
        if (!fs_1.default.existsSync(fileTempDir)) {
            fs_1.default.mkdirSync(fileTempDir, { recursive: true });
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(fileBuffer).toString();
        fs_1.default.writeFileSync(fileTempPath, pdfBuffer);
        if (fileTempPath) {
            const mailResponse = await new core_1.default().createMailTransporter({
                to: patientData['email'],
                subject: 'Laboratory Result',
                html: '<h5>Please find the attached Result of your lab tests.Use this password to open the file <strong>TiifuHamza</strong></h5>',
                attachments: [
                    {
                        filename: 'result.pdf',
                        path: fileTempPath,
                    },
                ],
            });
            if (mailResponse && (mailResponse === null || mailResponse === void 0 ? void 0 : mailResponse.rejected) && (mailResponse === null || mailResponse === void 0 ? void 0 : mailResponse.rejected.length) === 0) {
                return response.status(201).json({ status: true });
            }
        }
    }
    catch (error) {
        console.error('Error sending email:', error);
        response.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message,
        });
    }
};
exports.sendResultViaEmailHandler = sendResultViaEmailHandler;
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
        console.error('Get test creation rules error:', error);
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
        console.error('Error in complete flow bypass:', error);
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
        console.error('Error in complete flow bypass multiple:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};
exports.completeFlowByPassMultipleHandler = completeFlowByPassMultipleHandler;
