"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientVitalSign = exports.createNewVitalSign = exports.getCustomers = void 0;
const registration_1 = __importDefault(require("../../models/registration/registration"));
const vitalsign_1 = __importDefault(require("../../models/customers/vitalsign"));
async function getCustomers(request, response) {
    try {
        const tenantId = parseInt(request.query.tenantId, 10);
        const data = await new registration_1.default().getCustomersRecords(tenantId, request.query);
        response.send(data);
    }
    catch (err) {
        response.send([]);
    }
}
exports.getCustomers = getCustomers;
async function createNewVitalSign(request, response) {
    try {
        const { patientid } = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        const isCreated = await new vitalsign_1.default(patientid).createNewVitalSignChart(tenantId, request.body);
        response.send({ status: isCreated });
    }
    catch (err) {
        response.send([]);
    }
}
exports.createNewVitalSign = createNewVitalSign;
async function getPatientVitalSign(request, response) {
    try {
        const { patientid, count, page, filterFrom, filterTo } = request.query;
        if (!patientid) {
            return response.status(400).send({ error: 'Missing required parameter: patientid' });
        }
        const filterFromDate = filterFrom ? new Date(filterFrom) : null;
        const filterToDate = filterTo ? new Date(filterTo) : null;
        const parsedCount = parseInt(count, 10);
        const parsedPage = parseInt(page, 10);
        if (isNaN(parsedCount) || isNaN(parsedPage)) {
            return response.status(400).send({ error: 'Invalid count or page parameter' });
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const vitalSignInstance = new vitalsign_1.default(parseInt(patientid, 10));
        const vitalSigns = await vitalSignInstance.getPatientVitalSignList(tenantId, parsedCount, parsedPage, filterFromDate, filterToDate);
        response.send({ vitalSigns });
    }
    catch (err) {
        console.log(err);
        response.status(500).send({ error: 'An error occurred while fetching vital signs' });
    }
}
exports.getPatientVitalSign = getPatientVitalSign;
