"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUltrasoundScanTestListHandler = exports.updateUltrasoundTemplateHandler = exports.getUltrasoundTemplateSingleDetailHandler = exports.createUltrasoundTemplateHandler = exports.getUltrasoundTestListHandler = void 0;
const testpanelList_1 = require("../../testpanel/testpanelList");
const creator_1 = __importDefault(require("../../models/creator/creator"));
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const getUltrasoundTestListHandler = async function (request, response) {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const ultrasoundList = await testpanelList_1.testpanel.getUltrasoundScanTestList(tenantId);
        response.send(ultrasoundList);
    }
    catch (err) {
        logger_1.default.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.getUltrasoundTestListHandler = getUltrasoundTestListHandler;
const createUltrasoundTemplateHandler = async function (request, response) {
    try {
        const { fields, employeeid, visibleToAll, associatedbodypart, name, testid } = request.body;
        const parsedVisibleToAll = parseInt(visibleToAll.toString());
        if (!associatedbodypart)
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ + ' .Associated body part not included', 404, response);
        const isValidBodyPart = fields && employeeid && (parsedVisibleToAll == 0 || parsedVisibleToAll == 1) && associatedbodypart && testid && typeof testid == 'number' && Array.isArray(fields) && name;
        if (!isValidBodyPart) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const isCreated_Value = await creator_1.default.createUltrasoundTemplate(tenantId, request.body);
        response.send({ status: isCreated_Value });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.createUltrasoundTemplateHandler = createUltrasoundTemplateHandler;
const getUltrasoundTemplateSingleDetailHandler = async function (request, response) {
    try {
        const { templateid } = request.query;
        const parsedTemplateId = parseInt(templateid.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const templateDetail = await creator_1.default.getUltrasoundTemplateSingleDetail(tenantId, parsedTemplateId);
        response.send(templateDetail);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getUltrasoundTemplateSingleDetailHandler = getUltrasoundTemplateSingleDetailHandler;
const updateUltrasoundTemplateHandler = async function (request, response) {
    try {
        const { fields, employeeid, visibleToAll, associatedbodypart, name, testid } = request.body;
        const isValidBodyPart = fields && employeeid && (visibleToAll == 0 || visibleToAll == 1) && associatedbodypart && testid && typeof testid == 'number' && Array.isArray(fields) && name;
        if (!isValidBodyPart) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const isCreated_Value = await creator_1.default.updateUltrasoundTemplate(tenantId, request.body);
        response.send({ status: isCreated_Value });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateUltrasoundTemplateHandler = updateUltrasoundTemplateHandler;
const getUltrasoundScanTestListHandler = async function (request, response) {
    try {
        const { count, page, employeeid, testid } = request.query;
        const isValidQuery = count && page && employeeid
            && typeof count == 'string' && typeof page == 'string' && typeof employeeid == 'string';
        if (isValidQuery) {
            let parsedTestId;
            if (testid) {
                parsedTestId = parseInt(testid.toString());
            }
            const tenantId = parseInt(request.query.tenantId.toString());
            if (testid && !isNaN(parsedTestId)) {
                const list = await creator_1.default.getUltrasoundTypeTemplates(tenantId, parsedTestId, parseInt(count.toString()), parseInt(page.toString()), parseInt(employeeid.toString()));
                response.send(list);
            }
            else {
                const list = await creator_1.default.getUltrasoundTemplatesAll(tenantId, parseInt(count.toString()), parseInt(page.toString()), parseInt(employeeid.toString()));
                response.send(list);
            }
        }
        else {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, 400, response);
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.getUltrasoundScanTestListHandler = getUltrasoundScanTestListHandler;
