"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSalesSessionAvailableHandler = exports.handleEndSalesSession = exports.getSalesSessionList = exports.handleCreateNewSalesSesion = void 0;
const SalesSessionRepo_1 = require("../../../models/billing/repositories/SalesSessionRepo");
const helper_1 = require("../../../hooks/helper");
const handleCreateNewSalesSesion = async function (request, response) {
    try {
        const { tenantId } = request.query;
        const parsedTenantId = parseInt(tenantId.toString());
        const requestBody = request.body;
        const status = await new SalesSessionRepo_1.SalesSessionRepo(parsedTenantId).create(requestBody);
        if (typeof status === 'string') {
            return response.status(400).send({ error: status, status: false });
        }
        if (typeof status === 'boolean' && !status) {
            return response.status(400).send({ error: "creating sales sesison failed", status: false });
        }
        response.status(201).send({ status });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err === null || err === void 0 ? void 0 : err.message);
    }
};
exports.handleCreateNewSalesSesion = handleCreateNewSalesSesion;
const getSalesSessionList = async function (request, response) {
    try {
        const { limit, page, tenantId } = request.query;
        const parsedLimit = parseInt(limit) || 10;
        const parsedTenantId = parseInt(tenantId);
        const parsedPage = parseInt(page) || 1;
        const list = await new SalesSessionRepo_1.SalesSessionRepo(parsedTenantId).findSessionsPaginated(parsedPage, parsedLimit);
        response.send(list);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err === null || err === void 0 ? void 0 : err.message);
    }
};
exports.getSalesSessionList = getSalesSessionList;
const handleEndSalesSession = async function (request, response) {
    try {
        const { tenantId } = request.query;
        const { sessionId, validatedby, handingoveramount } = request.body;
        const parsedTenantId = parseInt(tenantId.toString());
        const status = await new SalesSessionRepo_1.SalesSessionRepo(parsedTenantId).endSession(sessionId, validatedby, handingoveramount);
        response.status(200).send({ status });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err === null || err === void 0 ? void 0 : err.message);
    }
};
exports.handleEndSalesSession = handleEndSalesSession;
const hasSalesSessionAvailableHandler = async function (request, response) {
    try {
        const { tenantId, branchid, sessiondate } = request.query;
        const parsedTenantId = parseInt(tenantId.toString());
        if (!sessiondate) {
            (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " sale session not provided", 404, response);
        }
        else {
            const hasSession = await new SalesSessionRepo_1.SalesSessionRepo(parsedTenantId).hasActiveSessionForDate(sessiondate, branchid);
            response.send({ status: hasSession });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.hasSalesSessionAvailableHandler = hasSalesSessionAvailableHandler;
