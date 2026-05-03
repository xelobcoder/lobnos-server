"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInsurance = exports.updateInsurance = exports.getInsuranceById = exports.getAllInsurances = exports.createInsurance = void 0;
const Insurance_1 = __importDefault(require("../../models/insurance/Insurance"));
const createInsurance = async (req, res) => {
    try {
        const data = req.body;
        const requiredFields = [
            'insuranceName',
            'insuranceCode',
            'insuranceType',
            'network',
            'mailingAddress',
            'city',
            'state',
            'county',
            'zipCode'
        ];
        for (let field of requiredFields) {
            if (!data[field]) {
                return res.status(400).json({ error: `Field ${field} is required` });
            }
        }
        const insurance = new Insurance_1.default();
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await insurance.create(tenantId, data);
        res.status(201).json({ message: 'Insurance created successfully', insuranceId: result });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error creating insurance record', message: error === null || error === void 0 ? void 0 : error.sqlMessage });
    }
};
exports.createInsurance = createInsurance;
const getAllInsurances = async (req, res) => {
    const { page = 1, pageSize = 10 } = req.query;
    try {
        const insurance = new Insurance_1.default();
        const tenantId = parseInt(req.query.tenantId.toString());
        const insurances = await insurance.getAllInsurances(tenantId, Number(page), Number(pageSize));
        res.status(200).json(insurances);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching insurance records' });
    }
};
exports.getAllInsurances = getAllInsurances;
const getInsuranceById = async (req, res) => {
    const { insuranceId } = req.params;
    try {
        const insurance = new Insurance_1.default(Number(insuranceId));
        const tenantId = parseInt(req.query.tenantId.toString());
        const insuranceData = await insurance.getInsuranceById(tenantId, Number(insuranceId));
        if (insuranceData) {
            res.status(200).json(insuranceData);
        }
        else {
            res.status(404).json({ message: 'Insurance not found' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching insurance data' });
    }
};
exports.getInsuranceById = getInsuranceById;
const updateInsurance = async (req, res) => {
    const { insuranceId } = req.params;
    const data = req.body;
    try {
        const insurance = new Insurance_1.default(Number(insuranceId));
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await insurance.update(tenantId, data);
        if (result > 0) {
            res.status(200).json({ message: 'Insurance updated successfully' });
        }
        else {
            res.status(404).json({ message: 'Insurance not found' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating insurance data' });
    }
};
exports.updateInsurance = updateInsurance;
const deleteInsurance = async (req, res) => {
    const { insuranceId } = req.params;
    try {
        const insurance = new Insurance_1.default(Number(insuranceId));
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await insurance.delete(tenantId);
        if (result > 0) {
            res.status(200).json({ message: 'Insurance deleted successfully' });
        }
        else {
            res.status(404).json({ message: 'Insurance not found' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error deleting insurance record' });
    }
};
exports.deleteInsurance = deleteInsurance;
