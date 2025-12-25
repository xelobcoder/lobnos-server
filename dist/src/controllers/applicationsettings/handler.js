"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctRefererErrorPostRegistrationHandler = exports.submitBillingHandler = exports.checkoutBillingHandler = exports.initializeBillingHandler = exports.getCategoryColumns = exports.columnFiltering = exports.TableFiltering = exports.resultEntrySettingsUpdateHandler = exports.resultEntrySettingsHandler = exports.validateUserRole = exports.updateResultSettings = exports.getResultSettings = exports.deleteTax = exports.changeTaxStatus = exports.updateTax = exports.getTax = exports.addTax = exports.getRegistrationSettings = exports.updateRegistrationFields = exports.updateEmailPreference = exports.updateGeneralEmailSettings = exports.getGeneralEmailSettings = exports.getEmailPreference = exports.getSmsSettings = exports.updateSmsSettings = exports.updateApplicationSettings = exports.updateApplicationBillSettingsHandler = exports.getApplicationSettingsBilling = exports.getApplicationSettings = void 0;
const logger_1 = __importDefault(require("../../hooks/logger"));
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const interface_1 = require("../../database/interface");
const Tax_1 = __importDefault(require("../../models/application/Tax"));
const resultSettings_1 = __importDefault(require("../../models/application/appsettings/resultSettings"));
const appset_1 = __importDefault(require("./../../models/application/appsettings/appset"));
const helper_1 = require("../../hooks/helper");
const initCustomerBilling_1 = require("../../models/billing/multi/initCustomerBilling");
const billing_new_client_multi_1 = require("../../models/billing/billing-new-client-multi");
const customerBillingCheckout_1 = require("../../models/billing/multi/customerBillingCheckout");
const appsettings = new appset_1.default();
const tax = new Tax_1.default(null);
const result = new resultSettings_1.default(null);
const getApplicationSettings = async (req, response) => {
    try {
        const target = req.params.target;
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await appsettings.getAllAppSettings(tenantId);
        if (result && target) {
            if (result[target] !== undefined) {
                response.send({ statusCode: 200, status: "success", [target]: result[target] });
            }
            else {
                response.send({ statusCode: 404, status: "error", message: `${target} not found` });
            }
        }
        response.send({ statusCode: 200, status: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getApplicationSettings = getApplicationSettings;
const getApplicationSettingsBilling = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const data = await appsettings.getAppBillSettings(tenantId);
        res.send(data);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getApplicationSettingsBilling = getApplicationSettingsBilling;
const updateApplicationBillSettingsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const data = await appset_1.default.updateApplicationBillSettings(tenantId, req.body);
        res.send({ status: data > 0 ? true : false });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateApplicationBillSettingsHandler = updateApplicationBillSettingsHandler;
const updateApplicationSettings = async (request, response) => {
    try {
        const data = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        const is_updated = await appsettings.updateApplicationSettings(tenantId, data);
        is_updated && response.send({ message: "Applications settings updated successfully", statusCode: 200, status: "success" });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.updateApplicationSettings = updateApplicationSettings;
const updateSmsSettings = async (req, res) => {
    try {
        const data = JSON.stringify(req.body);
        const tenantId = parseInt(req.query.tenantId.toString());
        const is_updated = await appsettings.updateSmsSettings(tenantId, data);
        res.send({ status: is_updated });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateSmsSettings = updateSmsSettings;
const getSmsSettings = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const sms_settings = await appsettings.getSmsSettings(tenantId);
        response.send(sms_settings);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getSmsSettings = getSmsSettings;
const getEmailPreference = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await appsettings.getEmailPreference(tenantId);
        res.send({ message: "success", status: "success", statusCode: 200, result });
    }
    catch (err) {
        (0, helper_1.customError)("something went wrong", 500, res);
    }
};
exports.getEmailPreference = getEmailPreference;
const getGeneralEmailSettings = async (req, response) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await appsettings.getGeneralEmailSettings(tenantId);
        response.send({ message: "success", status: "success", statusCode: 200, result });
    }
    catch (err) {
        (0, helper_1.customError)("something went wrong", 500, response);
    }
};
exports.getGeneralEmailSettings = getGeneralEmailSettings;
const updateGeneralEmailSettings = async (request, res) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const result = await appsettings.updateGeneralEmailSettings(tenantId, request.body);
        res.send({
            message: result ? "updated successfully" : "No updates effected",
            status: "success",
            statusCode: 200,
        });
    }
    catch (err) {
        (0, helper_1.customError)("something went wrong", 500, res);
    }
};
exports.updateGeneralEmailSettings = updateGeneralEmailSettings;
const updateEmailPreference = (request, response) => {
    try {
        const data = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        const updated = appsettings.updateEmailPreference(tenantId, data);
        response.send(updated);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateEmailPreference = updateEmailPreference;
const updateRegistrationFields = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const result = await appsettings.updateRegistrationFields(tenantId, request.body);
        if (result === true) {
            response.send({ message: "fields updated successfully", statusCode: 200, status: "success" });
        }
        else {
            response.send({ message: "fields update failed", statusCode: "error", status: "error" });
        }
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(response);
    }
};
exports.updateRegistrationFields = updateRegistrationFields;
const getRegistrationSettings = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        let result = await appsettings.getRegistrationSettings(tenantId);
        if (result.length > 0) {
            result = result[0]["fields"];
            if (result !== "{}") {
                res.send(JSON.parse(result));
            }
            else {
                res.send(result);
            }
        }
        else {
            res.send({});
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getRegistrationSettings = getRegistrationSettings;
const addTax = (req, res) => {
    tax.addTax(req, res);
};
exports.addTax = addTax;
const getTax = (req, res) => {
    tax.getTax(req, res);
};
exports.getTax = getTax;
const updateTax = (req, res) => {
    tax.updateTax(req, res);
};
exports.updateTax = updateTax;
const changeTaxStatus = (req, res) => {
    tax.changeTaxStatus(req, res);
};
exports.changeTaxStatus = changeTaxStatus;
const deleteTax = (req, res) => {
    tax.deleteTax(req, res);
};
exports.deleteTax = deleteTax;
const getResultSettings = async (req, response) => {
    try {
        const { tenantId } = req.query;
        const resultSettings = await result.getResultSettings(parseInt(tenantId.toString()));
        response.send(resultSettings);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getResultSettings = getResultSettings;
const updateResultSettings = (req, res) => {
    result.updateResultSettings(req, res);
};
exports.updateResultSettings = updateResultSettings;
// RESULT ENTRY SETTINGS
const validateUserRole = async (employeeid, tenantId) => {
    const parsedEmployeeid = parseInt(employeeid.toString());
    const parsedTenantId = parseInt(tenantId.toString());
    const role = await new user_1.default(null, null, null, null, null).getUserRole(parsedEmployeeid, parsedTenantId);
    const validRoles = ["manager", "admin", "scientist"];
    return validRoles.includes(role.toLowerCase());
};
exports.validateUserRole = validateUserRole;
const handleInvalidRequest = (response) => {
    response.send({ status: false, message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ });
};
const resultEntrySettingsHandler = async (request, response) => {
    try {
        const { employeeid, tenantId } = request.query;
        if (!employeeid)
            return handleInvalidRequest(response);
        if (!(await (0, exports.validateUserRole)(employeeid, parseInt(tenantId.toString())))) {
            response.send({ status: false, message: "You do not have permission to delete this resources" /* OperationsFailures.dontHavePermission */ });
        }
        else {
            const settings = await resultSettings_1.default.getResultEntrySettings(parseInt(tenantId.toString()));
            response.send({ result: settings });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.resultEntrySettingsHandler = resultEntrySettingsHandler;
const resultEntrySettingsUpdateHandler = async (request, response) => {
    try {
        const { employeeid, tenantId } = request.query;
        if (!employeeid)
            return handleInvalidRequest(response);
        if (!(await (0, exports.validateUserRole)(employeeid, parseInt(tenantId.toString())))) {
            response.send({ status: false, message: "You do not have permission to delete this resources" /* OperationsFailures.dontHavePermission */ });
        }
        else {
            const result = await resultSettings_1.default.updateResultEntrySettings(parseInt(tenantId.toString()), request.body);
            response.send({ status: result });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.resultEntrySettingsUpdateHandler = resultEntrySettingsUpdateHandler;
const TableFiltering = async (request, response) => {
    try {
        const tablename = request.params;
        const { value, original = '', limit = 10, tenantId } = request.query;
        if (!tablename.tablename || !value || value.trim().length <= 0 || isNaN(limit)) {
            return (0, helper_1.customError)("Invalid request query parameters" /* OperationsFailures.invalidRequestParams */, 404, response);
        }
        const columnName = original && original.trim().length > 0 && original.trim() != "undefined" ? original : null;
        const tenantIdP = parseInt(request.query.tenantId, 10);
        const result = await TiifuWorkingClass_1.TiifuWorkingClass.filterDatabaseTable(tenantIdP, tablename.tablename, columnName, value, parseInt(limit.toString()));
        response.send(result);
    }
    catch (err) {
        if (err && (err === null || err === void 0 ? void 0 : err.code) == "ER_NO_SUCH_TABLE" /* OperationsFailures.ER_NO_SUCH_TABLE */) {
            response.send({ status: false, message: "ER_NO_SUCH_TABLE" /* OperationsFailures.ER_NO_SUCH_TABLE */ });
        }
        else {
            (0, helper_1.responseError)(response);
        }
    }
};
exports.TableFiltering = TableFiltering;
const columnFiltering = async (request, response) => {
    try {
        const tablename = request.params;
        const { tenantId } = request.query;
        if (tablename.column && typeof tablename.column === "string" && tablename.column.trim().length > 0) {
            const tenantIdP = parseInt(tenantId.toString(), 10);
            let columns = await TiifuWorkingClass_1.TiifuWorkingClass.getTableColumns(tenantIdP, tablename.column);
            if (columns.length > 0) {
                columns = columns.map((item) => ({
                    value: item.Field,
                    field: item.Field.replace(/[^\w\s]|_/g, ' ')
                }));
            }
            response.send(columns);
        }
        else {
            return (0, helper_1.customError)("Invalid request query parameters" /* OperationsFailures.invalidRequestParams */, 400, response);
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.columnFiltering = columnFiltering;
const getCategoryColumns = async (request, response) => {
    try {
        const { category, tenantId } = request.query;
        if (!category || category.trim().length <= 3) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, 400, response);
        }
        const tableName = interface_1.categoryColumnMapper[category];
        if (tableName) {
            const tenantIdP = parseInt(tenantId, 10);
            let columns = await TiifuWorkingClass_1.TiifuWorkingClass.getTableColumns(tenantIdP, tableName);
            if (columns.length > 0) {
                columns = columns.map((item) => ({
                    value: item.Field,
                    field: item.Field.replace(/[^\w\s]|_/g, ' ')
                }));
            }
            response.send(columns);
        }
        else {
            return (0, helper_1.customError)("Invalid category provided", 404, response);
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getCategoryColumns = getCategoryColumns;
const initializeBillingHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { entityId, entityType, isPackageUsed, packageid, patientId, referalCode, billingid, branchid, ispricingcheckout, } = req.query;
        const parsePatientId = parseInt(patientId, 10);
        const parseBillingId = billingid ? parseInt(billingid, 10) : undefined;
        const parseBranchId = branchid ? parseInt(branchid, 10) : undefined;
        let validatedEntityType = entityType;
        let parseEntityId = parseInt(entityId, 10);
        const parsePackageId = packageid ? parseInt(packageid, 10) : undefined;
        const parseIsPackageUsed = typeof isPackageUsed === "string"
            ? isPackageUsed === "true" || isPackageUsed === "1"
            : !!isPackageUsed;
        const billingSource = req.query.billingSource ? parseInt(req.query.billingSource, 10) : undefined;
        const pricingcheckout = ispricingcheckout ? ispricingcheckout === "true" : false;
        let referalData = null;
        if (referalCode) {
            // validate referal code
            referalData = await customerBillingCheckout_1.CustomerBillingCheckout.getInstance(tenantId).getReferralByCode(referalCode);
            if (!referalData) {
                return res.status(400).json({ success: false, message: 'Invalid referal code' });
            }
            referalData.entity_id && (parseEntityId = parseInt(referalData.entity_id.toString(), 10));
            referalData.entity_type && (validatedEntityType = referalData.entity_type);
        }
        const parsed = {
            entityId: parseEntityId,
            entityType: validatedEntityType,
            patientId: parsePatientId,
            isPackageUsed: parseIsPackageUsed,
            billingid: parseBillingId,
            packageid: parsePackageId,
            includeServices: req.query.includeServices ? req.query.includeServices === "true" : false,
            branchid: parseBranchId,
            billingSource: billingSource,
            pricingcheckout,
            referalCode: referalCode ? referalCode : undefined
        };
        const billingInit = initCustomerBilling_1.CustomerBillingInit.getInstance(tenantId);
        const result = await billingInit.init(parsed);
        if (typeof result === "object" && result.hasOwnProperty('testList')) {
            res.send(result);
        }
        else {
            res.status(200).send({
                status: false,
                message: result
            });
        }
    }
    catch (err) {
        console.error(err);
        (0, helper_1.responseError)(res, err);
    }
};
exports.initializeBillingHandler = initializeBillingHandler;
const checkoutBillingHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        if (!tenantId)
            return res.status(400).json({ success: false, message: 'Missing tenantId' });
        const { patientId, billingid, cart, servicesList, paymentDetails, branchid, billingSource, referalCode, entityid, ispricingcheckout, entitytype, promoCode, isPromo, isPackageUsed, packageid } = req.body;
        const result = await customerBillingCheckout_1.CustomerBillingCheckout.checkoutCustomerBilling({
            patientId,
            billingid,
            cart,
            servicesList,
            paymentDetails,
            branchid,
            billingSource,
            entitytype,
            ispricingcheckout,
            entityid,
            referalCode,
            promoCode,
            isPromo,
            isPackageUsed,
            packageid,
            tenantId
        });
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error(err);
        (0, helper_1.responseError)(res, err);
    }
};
exports.checkoutBillingHandler = checkoutBillingHandler;
const submitBillingHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { amountPayable, cart, servicesProvided, billingSource, paid, status, isConditionsUnderstood, patientid, employeeid, isPackageUsed, hasNightAdjustment, samplingCenter, payments, isPromo, isPayAll, promoMethod, patientId, billingid, paymentDetails, branchid, referalCode, promoCode, packageid, servicesList, entitytype, entityId, additionalinformation, isAdjustment, writeOffOutstanding, adjustmentType, adjustmentReason, nhismembershipid, claimscheckcode } = req.body;
        const result = await new billing_new_client_multi_1.SubmitCustomerBilling({
            tenantId,
            amountPayable,
            cart,
            servicesProvided,
            billingSource,
            paid,
            status,
            additionalinformation,
            isAdjustment,
            adjustmentType,
            adjustmentReason,
            isConditionsUnderstood,
            patientId: patientid !== null && patientid !== void 0 ? patientid : patientId,
            employeeid,
            isPackageUsed,
            entitytype,
            writeOffOutstanding,
            hasNightAdjustment,
            samplingCenter,
            entityId: entityId ? parseInt(entityId.toString(), 10) : undefined,
            entityid: entityId ? parseInt(entityId.toString(), 10) : undefined,
            payments,
            isPromo,
            promoMethod,
            billingid,
            paymentDetails,
            branchid,
            referalCode,
            isPayAll,
            promoCode,
            packageid,
            servicesList,
            nhismembershipid,
            claimscheckcode
        }, tenantId).submit();
        res.send(result);
    }
    catch (err) {
        console.error(err);
        (0, helper_1.responseError)(res, err);
    }
};
exports.submitBillingHandler = submitBillingHandler;
const correctRefererErrorPostRegistrationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const { entity_type, entity_id, branchid, billingid, employeeId } = req.body;
        if (!entity_type || !entity_id || !employeeId || !billingid || !branchid) {
            return res.status(400).json({ success: false, message: 'Missing entity_type or entity_id or employeeId or billingid or branchid' });
        }
        const isvalid_entity_id = !isNaN(parseInt(entity_id.toString(), 10));
        if (!isvalid_entity_id) {
            return res.status(400).json({ success: false, message: 'Invalid entity_id' });
        }
        const pEmployeeId = parseInt(employeeId.toString(), 10);
        const result = await customerBillingCheckout_1.CustomerBillingCheckout.correctRefererErrorPostRegistration(tenantId, pEmployeeId, entity_type, parseInt(entity_id.toString(), 10), billingid, branchid);
        if (typeof result === 'string') {
            return res.status(400).json({ success: false, message: result });
        }
        res.send(result);
    }
    catch (err) {
        console.error(err);
        (0, helper_1.responseError)(res, err);
    }
};
exports.correctRefererErrorPostRegistrationHandler = correctRefererErrorPostRegistrationHandler;
