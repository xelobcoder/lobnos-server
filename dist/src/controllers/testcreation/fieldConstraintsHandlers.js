"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFieldConstraintsByFieldIdHandler = exports.deleteFieldConstraintHandler = exports.updateFieldConstraintHandler = exports.getFieldConstraintsByTestIdHandler = exports.getFieldConstraintsByFieldIdHandler = exports.createFieldConstraintsHandler = void 0;
const FieldConstraintsRepository_repo_1 = __importDefault(require("../../models/TestCreation/repositories/FieldConstraintsRepository.repo"));
const helper_1 = require("../../hooks/helper");
const createFieldConstraintsHandler = async (req, res) => {
    try {
        const { constraints } = req.body;
        const tenantId = parseInt(req.query.tenantId, 10);
        if (!constraints)
            return (0, helper_1.customError)('Missing required parameters', 400, res);
        const repository = new FieldConstraintsRepository_repo_1.default(tenantId);
        const result = await repository.create(constraints);
        res.status(201).json({ status: true, data: result });
    }
    catch (error) {
        return (0, helper_1.responseError)(res);
    }
};
exports.createFieldConstraintsHandler = createFieldConstraintsHandler;
const getFieldConstraintsByFieldIdHandler = async (req, res) => {
    try {
        const fieldId = parseInt(req.params.fieldId.toString(), 10);
        const tenantId = req.query.tenantId;
        if (!fieldId)
            return (0, helper_1.customError)('Missing required parameters', 400, res);
        const parsedTenantId = parseInt(tenantId, 10);
        const repository = new FieldConstraintsRepository_repo_1.default(parsedTenantId);
        const constraints = await repository.findByFieldId(fieldId);
        return res.json({ status: true, data: constraints });
    }
    catch (error) {
        return (0, helper_1.responseError)(res);
    }
};
exports.getFieldConstraintsByFieldIdHandler = getFieldConstraintsByFieldIdHandler;
const getFieldConstraintsByTestIdHandler = async (req, res) => {
    try {
        const testId = parseInt(req.params.testId.toString(), 10);
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        if (!testId) {
            return (0, helper_1.customError)('Missing required parameters', 400, res);
        }
        const repository = new FieldConstraintsRepository_repo_1.default(tenantId);
        const constraints = await repository.findByTestId(Number(testId));
        return res.json({ success: true, data: constraints });
    }
    catch (error) {
        console.error('Get field constraints by test error:', error);
        return (0, helper_1.responseError)(res);
    }
};
exports.getFieldConstraintsByTestIdHandler = getFieldConstraintsByTestIdHandler;
const updateFieldConstraintHandler = async (req, res) => {
    try {
        const id = req.params.id;
        const updates = req.body;
        const tenantId = parseInt(req.query.tenantId, 10);
        if (!id || !updates)
            return (0, helper_1.customError)('Missing required parameters', 400, res);
        const repository = new FieldConstraintsRepository_repo_1.default(tenantId);
        const success = await repository.update(Number(id), updates);
        return res.json({ success });
    }
    catch (error) {
        console.error('Update field constraint error:', error);
        return (0, helper_1.responseError)(res);
    }
};
exports.updateFieldConstraintHandler = updateFieldConstraintHandler;
const deleteFieldConstraintHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Missing required parameters', 400, res);
        }
        const repository = new FieldConstraintsRepository_repo_1.default(tenantId);
        const success = await repository.delete(Number(id));
        return res.json({ success });
    }
    catch (error) {
        console.error('Delete field constraint error:', error);
        return (0, helper_1.responseError)(res);
    }
};
exports.deleteFieldConstraintHandler = deleteFieldConstraintHandler;
const deleteFieldConstraintsByFieldIdHandler = async (req, res) => {
    try {
        const { fieldId } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId || !fieldId) {
            return (0, helper_1.customError)('Missing required parameters', 400, res);
        }
        const repository = new FieldConstraintsRepository_repo_1.default(tenantId);
        const success = await repository.deleteByFieldId(Number(fieldId));
        return res.json({ success });
    }
    catch (error) {
        console.error('Delete field constraints by field error:', error);
        return (0, helper_1.responseError)(res);
    }
};
exports.deleteFieldConstraintsByFieldIdHandler = deleteFieldConstraintsByFieldIdHandler;
