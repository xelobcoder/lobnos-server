"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalaryGradesInRangeHandler = exports.deactivateSalaryGradeHandler = exports.updateSalaryGradeHandler = exports.getAllSalaryGradesHandler = exports.getSalaryGradeByNameHandler = exports.getSalaryGradeByIdHandler = exports.createSalaryGradeHandler = void 0;
const helper_1 = require("../../hooks/helper");
const SalaryGradeRepository_1 = require("../../models/payroll/SalaryGradeRepository");
/**
 * Create a new salary grade
 */
const createSalaryGradeHandler = async (req, res) => {
    var _a;
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { grade_name, grade_level, min_salary, max_salary, description, currency, is_active } = req.body;
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const id = await repo.create({
            grade_name,
            grade_level,
            min_salary,
            max_salary,
            description,
            currency: currency || 'GHS',
            is_active: is_active !== undefined ? is_active : true,
            created_by: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id // Assuming user info is available
        });
        res.json({
            status: 'success',
            statusCode: 201,
            message: 'Salary grade created successfully',
            result: { id }
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to create salary grade', 500, res);
    }
};
exports.createSalaryGradeHandler = createSalaryGradeHandler;
/**
 * Get salary grade by ID
 */
const getSalaryGradeByIdHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Grade ID are required', 400, res);
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const grade = await repo.getById(id);
        if (!grade) {
            return (0, helper_1.customError)('Salary grade not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            result: grade
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve salary grade', 500, res);
    }
};
exports.getSalaryGradeByIdHandler = getSalaryGradeByIdHandler;
/**
 * Get salary grade by name
 */
const getSalaryGradeByNameHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const gradeName = req.params.name;
        if (!tenantId || !gradeName) {
            return (0, helper_1.customError)('Tenant ID and Grade name are required', 400, res);
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const grade = await repo.getByName(gradeName);
        if (!grade) {
            return (0, helper_1.customError)('Salary grade not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            result: grade
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve salary grade by name', 500, res);
    }
};
exports.getSalaryGradeByNameHandler = getSalaryGradeByNameHandler;
/**
 * Get all salary grades
 */
const getAllSalaryGradesHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const activeOnly = req.query.activeOnly !== 'false'; // Default to true
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const grades = await repo.getAll(activeOnly);
        res.json({
            status: 'success',
            statusCode: 200,
            result: grades
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve salary grades', 500, res);
    }
};
exports.getAllSalaryGradesHandler = getAllSalaryGradesHandler;
/**
 * Update salary grade
 */
const updateSalaryGradeHandler = async (req, res) => {
    var _a;
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const updateData = req.body;
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Grade ID are required', 400, res);
        }
        // Add updated_by if user info is available
        if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) {
            updateData.updated_by = req.user.id;
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const success = await repo.update(id, updateData);
        if (!success) {
            return (0, helper_1.customError)('Failed to update salary grade', 400, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Salary grade updated successfully'
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to update salary grade', 500, res);
    }
};
exports.updateSalaryGradeHandler = updateSalaryGradeHandler;
/**
 * Deactivate salary grade
 */
const deactivateSalaryGradeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Grade ID are required', 400, res);
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const success = await repo.deactivate(id);
        if (!success) {
            return (0, helper_1.customError)('Failed to deactivate salary grade', 400, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Salary grade deactivated successfully'
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to deactivate salary grade', 500, res);
    }
};
exports.deactivateSalaryGradeHandler = deactivateSalaryGradeHandler;
/**
 * Get salary grades within salary range
 */
const getSalaryGradesInRangeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const minSalary = parseFloat(req.query.minSalary);
        const maxSalary = parseFloat(req.query.maxSalary);
        if (!tenantId || isNaN(minSalary) || isNaN(maxSalary)) {
            return (0, helper_1.customError)('Tenant ID, minSalary, and maxSalary are required', 400, res);
        }
        const repo = new SalaryGradeRepository_1.SalaryGradeRepository(tenantId);
        const grades = await repo.getGradesInSalaryRange(minSalary, maxSalary);
        res.json({
            status: 'success',
            statusCode: 200,
            result: grades
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve salary grades in range', 500, res);
    }
};
exports.getSalaryGradesInRangeHandler = getSalaryGradesInRangeHandler;
