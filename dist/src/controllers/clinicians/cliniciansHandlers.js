"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postProcessedOrderHandler = exports.getTemporaryOrdersProcessingHandler = exports.getTemporaryOrdersHandler = exports.postTemporaryOrderHandler = exports.getBillingTestBasedByClinicianHandler = exports.getClinicianResultHandler = exports.filterClinicianHandler = exports.postCliniciansHandler = exports.deleteCliniciansHandler = exports.putCliniciansHandler = exports.getSingleClinicianHandler = exports.getCliniciansHandler = void 0;
const express_1 = require("express");
const registration_1 = __importDefault(require("../../models/registration/registration"));
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const clinicianClass_1 = __importDefault(require("../../models/clincians/clinicianClass"));
async function getCliniciansHandler(request, response) {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const cliniciansList = await new clinicianClass_1.default().getClinicians(tenantId, request.query);
        return response.send({ statusCode: 200, status: "success", result: cliniciansList });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.getCliniciansHandler = getCliniciansHandler;
async function getSingleClinicianHandler(req, res) {
    const { id } = req.query;
    if (!id) {
        return (0, helper_1.customError)("clinicianid required", 404, res);
    }
    const tenantId = parseInt(req.query.tenantId.toString());
    try {
        // Fetch clinician data using the provided ID
        const result = await new clinicianClass_1.default().getSingleClinician(tenantId, parseInt(id));
        if (result) {
            return res.send({
                statusCode: 200,
                result,
                status: "success",
            });
        }
        else {
            return res.send({
                statusCode: 404,
                status: "error",
                message: "Clinician not found",
            });
        }
    }
    catch (err) {
        return res.send({
            statusCode: 500,
            status: "error",
            message: "Error fetching clinician data",
        });
    }
}
exports.getSingleClinicianHandler = getSingleClinicianHandler;
async function putCliniciansHandler(req, res) {
    try {
        const { id } = req.body;
        if (!id)
            (0, helper_1.customError)("Clinician id not added", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const isUpdated = await new clinicianClass_1.default().putCliniciansBasic(tenantId, req.body);
        if (isUpdated) {
            res.send({
                statusCode: 200,
                message: "Clinician updated successfully",
                status: "success",
            });
        }
        else {
            res.send({
                statusCode: 401,
                message: "Clinician not updated",
            });
        }
    }
    catch (error) {
        (0, helper_1.responseError)(express_1.response);
    }
}
exports.putCliniciansHandler = putCliniciansHandler;
async function deleteCliniciansHandler(request, response) {
    try {
        const { id } = request.body;
        if (!id || isNaN(id)) {
            return (0, helper_1.customError)("id required", 404, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const status = await new clinicianClass_1.default().deleteClinicians(tenantId, id);
        if (status) {
            response.send({
                statusCode: 200,
                status: "success",
                message: "Deleted successfully",
            });
        }
        else {
            response.send({
                statusCode: 500,
                status: "error",
                message: "Something went wrong. Wrong ID provided",
            });
        }
    }
    catch (error) {
        logger_1.default.error(error);
        (0, helper_1.responseError)(response);
    }
}
exports.deleteCliniciansHandler = deleteCliniciansHandler;
async function postCliniciansHandler(req, res) {
    try {
        const outcome = await new clinicianClass_1.default().postClinicianBasicInfo(req, res);
        if (typeof outcome !== "number" || typeof outcome === "string") {
            return (0, helper_1.customError)(outcome, 404, res);
        }
        res.send({ message: "clinician added successfully", statusCode: 200, status: "success" });
    }
    catch (err) {
        (0, helper_1.customError)("Something wrong ocured", 500, res);
    }
}
exports.postCliniciansHandler = postCliniciansHandler;
async function filterClinicianHandler(req, res) {
    const { data } = req.body;
    if (!data) {
        (0, helper_1.customError)("please add data", 401, res);
        return;
    }
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new registration_1.default().getCustomersRecords(tenantId, data);
        res.send({ status: "success", statusCode: 200, result });
    }
    catch (err) {
        (0, helper_1.customError)("Something wrong ocured", 500, res);
    }
}
exports.filterClinicianHandler = filterClinicianHandler;
async function getClinicianResultHandler(req, res) {
    try {
        const { clinicianid, startdate, enddate } = req.query;
        if (!clinicianid) {
            (0, helper_1.customError)("please add clinicianid", 401, res);
            return;
        }
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new clinicianClass_1.default().getClinicianResult(tenantId, parseInt(clinicianid), startdate, enddate);
        res.send({ status: "success", statusCode: 200, result });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.customError)(err, 401, res);
    }
}
exports.getClinicianResultHandler = getClinicianResultHandler;
async function getBillingTestBasedByClinicianHandler(req, res) {
    try {
        const { billingid, clinicianid } = req.query;
        if (!billingid || !clinicianid) {
            (0, helper_1.customError)("please add billingid and clinicianid", 401, res);
            return;
        }
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new clinicianClass_1.default().getBillingTestBasedByClinician(tenantId, parseInt(billingid.toString()), parseInt(clinicianid));
        res.send({ statusCode: 200, status: "success", result });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.customError)((err === null || err === void 0 ? void 0 : err.message) || "something went wrong", 500, res);
    }
}
exports.getBillingTestBasedByClinicianHandler = getBillingTestBasedByClinicianHandler;
async function postTemporaryOrderHandler(req, res) {
    try {
        // const result = await new Registration().temporaryOrder(req.body);
        // if (result === true) {
        // 	res.send({ statusCode: 200, status: "success", message: "order added successfully" });
        // } else {
        // 	const message = result === false ? "kindly update orders in the order page" : "something went wrong while trying to add order";
        // 	customError(message, 500, res);
        // }
    }
    catch (err) {
        (0, helper_1.customError)("Something wrong ocured", 500, res);
    }
}
exports.postTemporaryOrderHandler = postTemporaryOrderHandler;
async function getTemporaryOrdersHandler(req, res) {
    const { clinicianid, target, date } = req.query;
    if (!target) {
        (0, helper_1.customError)("please addd target for query ", 401, res);
        return;
    }
    try {
        // const result = await new Registration().getTemporaryOrders(target, clinicianid, date);
        // res.send({ statusCode: 200, status: "success", result });
    }
    catch (err) {
        (0, helper_1.customError)("Something wrong ocured", 500, res);
    }
}
exports.getTemporaryOrdersHandler = getTemporaryOrdersHandler;
async function getTemporaryOrdersProcessingHandler(req, res) {
    const { orderid } = req.query;
    if (!orderid) {
        (0, helper_1.customError)("please add id", 401, res);
        return;
    }
    try {
        // const result = await  Registration.getTemporaryOrdersProcessing(orderid);
        // res.send({ statusCode: 200, status: "success", result });
    }
    catch (err) {
        (0, helper_1.customError)("Something wrong ocured", 500, res);
    }
}
exports.getTemporaryOrdersProcessingHandler = getTemporaryOrdersProcessingHandler;
async function postProcessedOrderHandler(req, res) {
    try {
        const { patientid, clinician, organization, orderid, test, payable, testcost, paid, taxIncluded, taxValue, status, discount, paymentmode, samplingCenter, outstanding, cost, employeeid, } = req.body;
        if (!employeeid || !clinician) {
            (0, helper_1.customError)("Bill can initiation failed, include employeeid and clincianid", 404, res);
            return;
        }
        // const billing = new Billing(
        // 	patientid,
        // 	clinician,
        // 	organization,
        // 	test,
        // 	payable,
        // 	testcost,
        // 	paid,
        // 	taxIncluded,
        // 	taxValue,
        // 	status,
        // 	discount,
        // 	paymentmode,
        // 	samplingCenter,
        // 	outstanding,
        // 	cost
        // );
        // const outcome = await billing.BillNewTransaction(req, res, employeeid, false);
        // if (typeof outcome === "string") {
        // 	customError(outcome, 404, res);
        // 	return;
        // }
        // if (typeof outcome === "boolean") {
        // 	if (outcome !== true) {
        // 		customError("error in processsing order", 404, res);
        // 		return;
        // 	}
        // 	const isUpdated = await new Registration().updateProcessedOrder(orderid);
        // 	if (!isUpdated) {
        // 		customError("error processing order", 500, res);
        // 		return;
        // 	}
        // 	res.send({ message: "order processed successfully", statusCode: 200, status: "success" });
        // }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.customError)((err === null || err === void 0 ? void 0 : err.message) || err, 500, res);
    }
}
exports.postProcessedOrderHandler = postProcessedOrderHandler;
