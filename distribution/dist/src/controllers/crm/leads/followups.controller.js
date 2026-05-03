"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFollowUp = exports.getPendingFollowUps = exports.getFollowUpsByStatus = exports.getFollowUpsByLeadId = exports.getFollowUpById = exports.getAllFollowUps = exports.updateFollowUp = exports.createFollowUp = void 0;
const followups_1 = require("../../../models/customers/leads/followups");
const helper_1 = require("../../../hooks/helper");
const createFollowUp = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const followUpData = req.body;
        const newFollowUp = await repo.create(followUpData);
        res.status(201).json({ success: true, data: newFollowUp });
    }
    catch (error) {
        console.error('Create follow-up error:', error);
        (0, helper_1.customError)('Failed to create follow-up', 400, res);
    }
};
exports.createFollowUp = createFollowUp;
const updateFollowUp = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const id = parseInt(req.params.id);
        const updates = req.body;
        const updatedRows = await repo.update(id, updates);
        if (updatedRows > 0) {
            res.status(200).json({ success: true, message: 'Follow-up updated successfully' });
        }
        else {
            (0, helper_1.customError)('Follow-up not found', 404, res);
        }
    }
    catch (error) {
        console.error('Update follow-up error:', error);
        (0, helper_1.customError)('Failed to update follow-up', 400, res);
    }
};
exports.updateFollowUp = updateFollowUp;
const getAllFollowUps = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const page = parseInt(req.query.page) || 1;
        const count = parseInt(req.query.count) || 10;
        const sortby = req.query.sortby || "DESC";
        const withlead = req.query.withlead === 'true';
        const data = await repo.findAllPaginated(page, count, sortby, withlead);
        res.status(200).json(Object.assign({ success: true }, data));
    }
    catch (error) {
        console.error('Get all follow-ups error:', error);
        (0, helper_1.customError)('Failed to fetch follow-ups', 500, res);
    }
};
exports.getAllFollowUps = getAllFollowUps;
const getFollowUpById = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const id = parseInt(req.params.id);
        const followUp = await repo.findById(id);
        if (followUp) {
            res.status(200).json({ success: true, data: followUp });
        }
        else {
            (0, helper_1.customError)('Follow-up not found', 404, res);
        }
    }
    catch (error) {
        console.error('Get follow-up by ID error:', error);
        (0, helper_1.customError)('Failed to fetch follow-up', 500, res);
    }
};
exports.getFollowUpById = getFollowUpById;
const getFollowUpsByLeadId = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const leadId = parseInt(req.params.leadId);
        const followUps = await repo.findByLeadId(leadId);
        res.status(200).json({ success: true, data: followUps });
    }
    catch (error) {
        console.error('Get follow-ups by lead ID error:', error);
        (0, helper_1.customError)('Failed to fetch follow-ups for lead', 500, res);
    }
};
exports.getFollowUpsByLeadId = getFollowUpsByLeadId;
const getFollowUpsByStatus = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const status = req.params.status;
        const followUps = await repo.findByStatus(status);
        res.status(200).json({ success: true, data: followUps });
    }
    catch (error) {
        console.error('Get follow-ups by status error:', error);
        (0, helper_1.customError)('Failed to fetch follow-ups by status', 500, res);
    }
};
exports.getFollowUpsByStatus = getFollowUpsByStatus;
const getPendingFollowUps = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const followUps = await repo.findPendingFollowups();
        res.status(200).json({ success: true, data: followUps });
    }
    catch (error) {
        console.error('Get pending follow-ups error:', error);
        (0, helper_1.customError)('Failed to fetch pending follow-ups', 500, res);
    }
};
exports.getPendingFollowUps = getPendingFollowUps;
const deleteFollowUp = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new followups_1.LeadFollowUpsRepo(tenantId);
        const id = parseInt(req.params.id);
        const deletedRows = await repo.delete(id);
        if (deletedRows > 0) {
            res.status(200).json({ success: true, message: 'Follow-up deleted successfully' });
        }
        else {
            (0, helper_1.customError)('Follow-up not found', 404, res);
        }
    }
    catch (error) {
        console.error('Delete follow-up error:', error);
        (0, helper_1.customError)('Failed to delete follow-up', 500, res);
    }
};
exports.deleteFollowUp = deleteFollowUp;
