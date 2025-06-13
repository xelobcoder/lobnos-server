"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateToResolveOutsourcedHandler = exports.getOutsourcedTestBasedStageHandler = exports.getTestOutSourcingOrganizations = exports.updateTestPanelOutsourcingInformation = exports.checkIsServiceRenderedByOutsourceOrganization = exports.getOrganizationOutsourcingAll = exports.getOrganizationOutSourceBasic = exports.getOrganizationOutSourceServices = exports.updateOrganizationOutSourceServices = exports.updateOrganizationOutSource = exports.createOrganizationOutSource = void 0;
const outsourcing_1 = __importDefault(require("../../models/organization/outsourcingOrganization/outsourcing"));
const helper_1 = require("../../hooks/helper");
const createOrganizationOutSource = async function (request, response) {
    try {
        const { contactNumber, name } = request.body;
        if (!contactNumber || !name || isNaN(contactNumber)) {
            return (0, helper_1.customError)('Invalid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const isCreated = await new outsourcing_1.default(name, contactNumber).createOutSourceOrganization(tenantId, request.body);
        response.send({ status: isCreated });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.createOrganizationOutSource = createOrganizationOutSource;
const updateOrganizationOutSource = async function (request, response) {
    try {
        const { outsourceid } = request.body;
        if (!outsourceid) {
            return (0, helper_1.customError)('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const isUpdated = await new outsourcing_1.default(null, null).updateOutsourceOrganization(tenantId, request.body);
        response.send({ status: isUpdated });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateOrganizationOutSource = updateOrganizationOutSource;
const updateOrganizationOutSourceServices = async function (request, response) {
    try {
        const { outsourceid } = request.body;
        if (!outsourceid) {
            return (0, helper_1.customError)('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const isUpdated = await new outsourcing_1.default(null, null).loadoutsourceOrganizationServices(tenantId, request.body);
        response.send({ status: isUpdated });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateOrganizationOutSourceServices = updateOrganizationOutSourceServices;
const getOrganizationOutSourceServices = async function (request, response) {
    try {
        const { outsourceid } = request.query;
        if (!outsourceid) {
            return (0, helper_1.customError)('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const data = await new outsourcing_1.default(null, null).getOrganizationOursourcePricing(tenantId, parseInt(outsourceid.toString()));
        response.send(data);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getOrganizationOutSourceServices = getOrganizationOutSourceServices;
const getOrganizationOutSourceBasic = async function (request, response) {
    try {
        const { outsourceid } = request.query;
        if (!outsourceid) {
            return (0, helper_1.customError)('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const data = await new outsourcing_1.default(null, null).getOrganizationBasicInformation(tenantId, parseInt(outsourceid.toString()));
        response.send(data);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getOrganizationOutSourceBasic = getOrganizationOutSourceBasic;
const getOrganizationOutsourcingAll = async function (request, response) {
    try {
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const data = await new outsourcing_1.default(null, null).getAllOutsourcingOrganization(tenantId, request.query);
        response.send(data);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getOrganizationOutsourcingAll = getOrganizationOutsourcingAll;
const checkIsServiceRenderedByOutsourceOrganization = async function (request, response) {
    try {
        const { testid, outsourceid } = request.query;
        const parsedTestid = parseInt(testid.toString());
        const parsedOutsourceid = parseInt(outsourceid.toString());
        if (!parsedTestid || !parsedOutsourceid) {
            return (0, helper_1.customError)('Invalid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const data = await new outsourcing_1.default(null, null).checkOrganizationProvideServicesForATest(tenantId, parsedTestid, parsedOutsourceid);
        const isAvailable = data.length > 0;
        response.send({ isProvideTest: isAvailable });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.checkIsServiceRenderedByOutsourceOrganization = checkIsServiceRenderedByOutsourceOrganization;
const updateTestPanelOutsourcingInformation = async function (request, response) {
    try {
        const { organizations, testid } = request.body;
        if (!organizations || !testid || !Array.isArray(organizations)) {
            return (0, helper_1.customError)('Invalid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const status = await new outsourcing_1.default(null, null).updateTestOutSourcingOrganization(tenantId, organizations, testid);
        response.send({ status });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateTestPanelOutsourcingInformation = updateTestPanelOutsourcingInformation;
const getTestOutSourcingOrganizations = async function (request, response) {
    try {
        const { testid } = request.query;
        const parsedTestid = parseInt(testid.toString());
        if (!testid || typeof parsedTestid != "number") {
            return (0, helper_1.customError)('Invalid request provided', 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const organization = await new outsourcing_1.default(null, null).getTestOutSourcingOrganizations(tenantId, parsedTestid);
        response.send(organization);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getTestOutSourcingOrganizations = getTestOutSourcingOrganizations;
const getOutsourcedTestBasedStageHandler = async function (request, response) {
    try {
        const { count, page } = request.query;
        const stage = request.params.stage;
        if (["unresolved", "resolved"].includes(stage) == false) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const result = await outsourcing_1.default.getOutsourcedTestBasedOnstage(tenantId, stage, page, count);
        response.send(result);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.getOutsourcedTestBasedStageHandler = getOutsourcedTestBasedStageHandler;
const updateToResolveOutsourcedHandler = async function (request, response) {
    try {
        const { serviceid, employeeid } = request.body;
        if (!serviceid || !employeeid || typeof serviceid != "number" || typeof employeeid != "number") {
            return response.send({ status: false, message: "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ });
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const status = await outsourcing_1.default.updateToResolveOutsourced(tenantId, serviceid, employeeid);
        response.send({ status });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateToResolveOutsourcedHandler = updateToResolveOutsourcedHandler;
