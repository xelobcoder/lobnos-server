"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllservicesHandler = exports.getAservicesHandler = exports.deleteServicesHandler = exports.updateServicesHandler = exports.createServicesHandler = void 0;
const services_1 = require("../../models/services/services");
const helper_1 = require("../../hooks/helper");
const createServicesHandler = async function (request, response) {
    try {
        const { name, price, employeeid } = request.body;
        if (!name || !price || !employeeid)
            return (0, helper_1.customError)('Invalid request body provided', 400, response);
        const tenantId = parseInt(request.query.tenantId.toString());
        const isCreated = await new services_1.Services(null).createAService(tenantId, name, price, employeeid);
        if (typeof isCreated === "string") {
            response.send({ status: false, message: isCreated });
        }
        else {
            response.send({ status: isCreated });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.createServicesHandler = createServicesHandler;
const updateServicesHandler = async function (request, response) {
    try {
        const { name, price, employeeid, serviceid } = request.body;
        if (!name || !price || !employeeid || !serviceid)
            return (0, helper_1.customError)('Invalid request body provided', 400, response);
        const tenantId = parseInt(request.query.tenantId.toString());
        const isCreated = await new services_1.Services(null).updateAservice(tenantId, name, price, employeeid, serviceid);
        response.send({ status: isCreated });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateServicesHandler = updateServicesHandler;
const deleteServicesHandler = async function (request, response) {
    try {
        const { serviceid } = request.query;
        const tenantId = parseInt(request.query.tenantId.toString());
        const parsedServicedId = parseInt(serviceid.toString());
        if (!parsedServicedId)
            return (0, helper_1.customError)('Invalid request query provided', 400, response);
        const isCreated = await new services_1.Services(parsedServicedId).deleteAservice(tenantId);
        response.send({ status: isCreated });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.deleteServicesHandler = deleteServicesHandler;
const getAservicesHandler = async function (request, response) {
    try {
        const { serviceid } = request.query;
        const parsedServicedId = parseInt(serviceid.toString());
        if (!parsedServicedId)
            return (0, helper_1.customError)('Invalid request query provided', 400, response);
        const tenantId = parseInt(request.query.tenantId.toString());
        const result = await new services_1.Services(parsedServicedId).getAService(tenantId);
        response.send({ status: result });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getAservicesHandler = getAservicesHandler;
const getAllservicesHandler = async function (request, response) {
    try {
        const { count, page } = request.query;
        const tenantId = parseInt(request.query.tenantId.toString());
        const result = await new services_1.Services(null).getAllservices(tenantId, count, page);
        response.send({ result });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getAllservicesHandler = getAllservicesHandler;
