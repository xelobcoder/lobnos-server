"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLead = exports.getLeadById = exports.getAllLeads = exports.updateLead = exports.createLead = void 0;
const LeadRepository_1 = require("../../../models/customers/leads/LeadRepository");
const helper_1 = require("../../../hooks/helper");
const createLead = async (req, res) => {
    try {
        const tenantIdStr = req.query.tenantId;
        if (!tenantIdStr || isNaN(Number(tenantIdStr))) {
            return (0, helper_1.customError)('Invalid tenant ID', 400, res);
        }
        const tenantId = parseInt(tenantIdStr, 10);
        const repo = new LeadRepository_1.CustomersLeads(tenantId);
        const leadData = req.body;
        const newLead = await repo.create(leadData);
        res.status(201).json({ success: true, data: newLead });
    }
    catch (error) {
        console.error('Create lead error:', error);
        if (error.message === 'A lead with this email address already exists') {
            (0, helper_1.customError)(error.message, 409, res);
        }
        else {
            (0, helper_1.customError)('Failed to create lead', 400, res);
        }
    }
};
exports.createLead = createLead;
const updateLead = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new LeadRepository_1.CustomersLeads(tenantId);
        const id = parseInt(req.params.id.toString());
        const updates = req.body;
        const updatedRows = await repo.update(id, updates);
        if (updatedRows > 0) {
            res.status(200).json({ success: true, message: 'Lead updated successfully' });
        }
        else {
            (0, helper_1.customError)('Lead not found', 404, res);
        }
    }
    catch (error) {
        console.error('Update lead error:', error);
        (0, helper_1.customError)('Failed to update lead', 400, res);
    }
};
exports.updateLead = updateLead;
const getAllLeads = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new LeadRepository_1.CustomersLeads(tenantId);
        const page = parseInt(req.query.page) || 1;
        const count = parseInt(req.query.count) || 10;
        const result = await repo.findAllPaginated(page, count);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        console.error('Get all leads error:', error);
        (0, helper_1.customError)('Failed to fetch leads', 500, res);
    }
};
exports.getAllLeads = getAllLeads;
const getLeadById = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new LeadRepository_1.CustomersLeads(tenantId);
        const id = parseInt(req.params.id.toString());
        const lead = await repo.findById(id);
        if (lead) {
            res.status(200).json({ success: true, data: lead });
        }
        else {
            (0, helper_1.customError)('Lead not found', 404, res);
        }
    }
    catch (error) {
        console.error('Get lead by ID error:', error);
        (0, helper_1.customError)('Failed to fetch lead', 500, res);
    }
};
exports.getLeadById = getLeadById;
const deleteLead = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new LeadRepository_1.CustomersLeads(tenantId);
        const id = parseInt(req.params.id.toString());
        const deletedRows = await repo.delete(id);
        if (deletedRows > 0) {
            res.status(200).json({ success: true, message: 'Lead deleted successfully' });
        }
        else {
            (0, helper_1.customError)('Lead not found', 404, res);
        }
    }
    catch (error) {
        console.error('Delete lead error:', error);
        (0, helper_1.customError)('Failed to delete lead', 500, res);
    }
};
exports.deleteLead = deleteLead;
