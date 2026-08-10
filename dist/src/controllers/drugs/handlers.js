"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertNewDrug = insertNewDrug;
exports.updateDrug = updateDrug;
exports.deleteDrug = deleteDrug;
exports.getDrugs = getDrugs;
exports.insertNewDrugCategory = insertNewDrugCategory;
exports.updateDrugCategory = updateDrugCategory;
exports.deleteDrugCategory = deleteDrugCategory;
exports.getDrugsCategory = getDrugsCategory;
const helper_1 = require("../../hooks/helper");
const drugsUpload_1 = require("../../models/drugs/drugsUpload");
async function insertNewDrug(req, res) {
    try {
        const { drug, addedOn, category, createdBy } = req.body;
        if (!drug || !category || !createdBy) {
            return res.status(400).json({ error: 'Drug name, category, and creator are required' });
        }
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const drugService = new drugsUpload_1.DrugManagementService();
        const result = await drugService.addNewDrug(tenantId, { drug, addedOn: addedOn || new Date(), category, createdBy });
        if (typeof result === 'boolean') {
            const message = result ? 'Drug added successfully' : 'Drug not added';
            return res.send({ status: result, message });
        }
        return res.send({ status: false, message: result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
async function updateDrug(req, res) {
    try {
        const { id, drug, addedOn, category, createdBy } = req.body;
        if (!id || !drug || !category || !createdBy) {
            return res.status(400).json({ error: 'Drug ID, name, category, and creator are required' });
        }
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const drugService = new drugsUpload_1.DrugManagementService();
        const result = await drugService.updateDrug(tenantId, { id, drug, addedOn, category, createdBy });
        if (typeof result === 'boolean') {
            const message = result ? 'Drug updated successfully' : 'Drug not updated';
            return res.send({ status: result, message });
        }
        return res.status(400).json({ error: result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
async function deleteDrug(req, res) {
    try {
        const { id, employeeid } = req.query;
        const parsedID = parseInt(id.toString());
        const parsedEmployeeid = parseInt(employeeid.toString());
        if (!parsedID) {
            return res.status(400).json({ error: 'Drug ID is required' });
        }
        const drugService = new drugsUpload_1.DrugManagementService();
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugService.deleteDrug(tenantId, parsedID, parsedEmployeeid);
        if (typeof result == 'boolean') {
            return res.send({ status: result, message: result ? 'Drug deleted successfully' : 'Drug not deleted' });
        }
        else {
            res.send({ status: false, message: result });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
async function getDrugs(req, res) {
    try {
        const drugService = new drugsUpload_1.DrugManagementService();
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const drugs = await drugService.getDrugs(tenantId);
        res.send(drugs);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
// Drug Category Controllers
async function insertNewDrugCategory(req, res) {
    try {
        const { categoryName, description, createdBy } = req.body;
        if (!categoryName || !createdBy) {
            return res.status(400).json({ error: 'Category name and creator are required' });
        }
        const drugCategoryService = new drugsUpload_1.DrugManagementService();
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugCategoryService.addNewDrugCategory(tenantId, { categoryName, description, createdBy });
        if (typeof result === 'boolean') {
            const message = result ? 'Drug Category added successfully' : 'Drug category not added';
            return res.send({ status: result, message });
        }
        return res.status(400).json({ error: result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
async function updateDrugCategory(req, res) {
    try {
        const { id, categoryName, description, createdBy } = req.body;
        if (!id || !categoryName || !description || !createdBy) {
            return res.status(400).json({ error: 'ID, category name, description, and creator are required' });
        }
        const drugCategoryService = new drugsUpload_1.DrugManagementService();
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugCategoryService.updateDrugCategory(tenantId, { id, categoryName, description, createdBy });
        if (typeof result === 'boolean') {
            const message = result ? 'Drug Category updated successfully' : 'Drug category not updated';
            return res.send({ status: result, message });
        }
        return res.status(400).json({ error: result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
async function deleteDrugCategory(req, res) {
    try {
        const id = req.params.id;
        const parsedID = parseInt(id.toString().slice(1));
        if (!parsedID) {
            return res.status(400).json({ error: 'Category ID is required' });
        }
        const drugCategoryService = new drugsUpload_1.DrugManagementService();
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugCategoryService.deleteDrugCategory(tenantId, parsedID);
        return res.send({ status: result, message: result ? 'Drug Category deleted successfully' : 'Drug category not deleted' });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
async function getDrugsCategory(req, res) {
    try {
        const tenantId = req.query.tenantId;
        const drugCategoryService = new drugsUpload_1.DrugManagementService();
        const categories = await drugCategoryService.getDrugsCategory(tenantId);
        res.send(categories);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
}
