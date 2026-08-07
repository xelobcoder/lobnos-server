"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDetailCategoryController = void 0;
const testFieldsCategoryClass_1 = __importDefault(require("../../models/operations/testFieldsCategoryClass"));
class TestDetailCategoryController {
    static async create(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const data = req.body;
        const result = await testFieldsCategoryClass_1.default.create(tenantId, data);
        res.status(201).json({ message: "Category created successfully", result });
    }
    static async getAll(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const { limit, offset, createdby } = req.query;
        const result = await testFieldsCategoryClass_1.default.getAll(tenantId, {
            limit: Number(limit) || 10,
            offset: Number(offset) || 0,
            createdby: createdby ? String(createdby) : null,
        });
        res.status(200).json(result);
    }
    static async getById(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const { id } = req.params;
        const result = await testFieldsCategoryClass_1.default.getById(tenantId, Number(id));
        if (!result) {
            res.status(404).json({ message: "Category not found" });
        }
        else {
            res.status(200).json(result);
        }
    }
    static async getByTestId(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const testid = req.params.testid;
            const result = await testFieldsCategoryClass_1.default.getByTestId(tenantId, Number(testid));
            res.status(200).json(result);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    }
    static async update(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const { id } = req.params;
        const data = req.body;
        const result = await testFieldsCategoryClass_1.default.update(tenantId, Number(id), data);
        if (!result) {
            res.status(404).json({ message: "Category not found" });
        }
        else {
            res.status(200).json({ message: "Category updated successfully" });
        }
    }
    static async softDelete(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const { id } = req.params;
        const result = await testFieldsCategoryClass_1.default.softDelete(tenantId, Number(id));
        if (!result) {
            res.status(404).json({ message: "Category not found" });
        }
        else {
            res.status(200).json({ message: "Category soft deleted successfully" });
        }
    }
    static async restore(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const { id } = req.params;
        const result = await testFieldsCategoryClass_1.default.restore(tenantId, Number(id));
        if (!result) {
            res.status(404).json({ message: "Category not found or not deleted" });
        }
        else {
            res.status(200).json({ message: "Category restored successfully" });
        }
    }
    static async delete(req, res) {
        const tenantId = parseInt(req.query.tenantId);
        const { id } = req.params;
        const result = await testFieldsCategoryClass_1.default.delete(tenantId, Number(id));
        if (!result) {
            res.status(404).json({ message: "Category not found" });
        }
        else {
            res.status(200).json({ message: "Category deleted successfully" });
        }
    }
}
exports.TestDetailCategoryController = TestDetailCategoryController;
exports.default = TestDetailCategoryController;
