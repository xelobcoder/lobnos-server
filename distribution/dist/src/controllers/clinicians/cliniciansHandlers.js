"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCliniciansHandler = exports.postProcessedOrderHandler = exports.getTemporaryOrdersProcessingHandler = exports.getTemporaryOrdersHandler = exports.postTemporaryOrderHandler = exports.getBillingTestBasedByClinicianHandler = exports.getClinicianResultHandler = exports.filterClinicianHandler = exports.verifyClinicianPhoneNumberAndEmailMiddleware = exports.postCliniciansHandler = exports.deleteCliniciansHandler = exports.putCliniciansHandler = exports.getSingleClinicianHandler = exports.bulkInsertCliniciansHandler = exports.getCliniciansHandler = void 0;
const express_1 = require("express");
const registration_1 = __importDefault(require("../../models/registration/registration"));
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const clinicianClass_1 = __importDefault(require("../../models/clincians/clinicianClass"));
async function getCliniciansHandler(request, response) {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        // Extract filter parameters from query
        const filterParams = {
            page: request.query.page,
            count: request.query.count,
            role: request.query.role,
            searchText: request.query.searchText,
            id: request.query.id,
            name: request.query.name,
            location: request.query.location,
            address: request.query.address,
            occupation: request.query.occupation,
            organization: request.query.organization,
            phone: request.query.phone,
            email: request.query.email,
            identifier: request.query.identifier,
        };
        const cliniciansList = await new clinicianClass_1.default().getClinicians(tenantId, filterParams);
        response.send({ statusCode: 200, status: "success", result: cliniciansList });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getCliniciansHandler = getCliniciansHandler;
const bulkInsertCliniciansHandler = async (req, res) => {
    try {
        const tenantId = parseFloat(req.query.tenantId);
        const clinicians = req.body.data;
        if (!Array.isArray(clinicians) || clinicians.length === 0) {
            return res.status(400).json({ success: false, message: "No clinicians provided" });
        }
        const clinicianClass = new clinicianClass_1.default();
        const results = await clinicianClass.insertCliniciansBulk(tenantId, clinicians);
        const successCount = results.filter(r => typeof r === 'number').length;
        const failCount = results.length - successCount;
        return res.status(200).json({
            success: failCount === 0,
            partialSuccess: failCount > 0 && successCount > 0,
            total: results.length,
            successCount,
            failCount,
            results
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Bulk insert failed", error: (error === null || error === void 0 ? void 0 : error.message) || error });
    }
};
exports.bulkInsertCliniciansHandler = bulkInsertCliniciansHandler;
async function getSingleClinicianHandler(req, res) {
    const { id } = req.query;
    if (!id) {
        return (0, helper_1.customError)("clinicianid required", 404, res);
    }
    const tenantId = parseInt(req.query.tenantId.toString());
    try {
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
        const parseId = parseInt(id);
        if (!id || isNaN(parseId)) {
            return (0, helper_1.customError)("id required", 404, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const status = await new clinicianClass_1.default().deleteClinicians(tenantId, parseId);
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
        const outcome = await new clinicianClass_1.default().postClinicianBasicInfo(Object.assign(Object.assign({}, req.body), { tenantId: req.query.tenantId }));
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
async function verifyClinicianPhoneNumberAndEmailMiddleware(request, response, next) {
    const phone = request.body.phone;
    const email = request.body.email;
    const TenantId = request.query.tenantId;
    if (!phone)
        return (0, helper_1.customError)("Phone number and email required", 401, response);
    const tenantIdP = parseInt(TenantId.toString());
    const clinicianClass = new clinicianClass_1.default();
    const result = await clinicianClass.verifyClinicianPhoneNumberAndEmail(tenantIdP, email, phone);
    if (result !== true) {
        return (0, helper_1.customError)(result, 401, response);
    }
    next();
}
exports.verifyClinicianPhoneNumberAndEmailMiddleware = verifyClinicianPhoneNumberAndEmailMiddleware;
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
        (0, helper_1.customError)((err === null || err === void 0 ? void 0 : err.message) || "something went wrong", 401, res);
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
        (0, helper_1.customError)((err === null || err === void 0 ? void 0 : err.message) || err, 500, res);
    }
}
exports.postProcessedOrderHandler = postProcessedOrderHandler;
async function getAllCliniciansHandler(req, res) {
    var _a;
    try {
        const tenantId = parseInt(((_a = req.query.tenantId) === null || _a === void 0 ? void 0 : _a.toString()) || '0');
        const cliniciansList = await clinicianClass_1.default.getAllClinicians(tenantId);
        res.status(200).json({ statusCode: 200, status: "success", result: cliniciansList });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(res);
    }
}
exports.getAllCliniciansHandler = getAllCliniciansHandler;
